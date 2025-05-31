import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { validateUserOperation, deductCredits, calculateCreditsRequired } from '@/lib/credits'
import { createClient } from '@/lib/supabase'
import { subscriptionService } from '@/lib/subscription-limits'

interface SeparationRequest {
  audioFileId: string
  selectedStems: string[]
  quality: 'standard' | 'pro'
}

export async function POST(request: NextRequest) {
  try {
    // Create Supabase server client with proper session handling for user auth
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {},
          remove() {}
        }
      }
    )
    
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    // Extract the token and set session
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Set the session for RLS
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '' // Not needed for this operation
    })

    // Parse request body
    const body: SeparationRequest = await request.json()
    const { audioFileId, selectedStems, quality } = body

    console.log('Separation request:', { audioFileId, selectedStems, quality, userId: user.id })

    // Validate input
    if (!audioFileId || !selectedStems || selectedStems.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: audioFileId, selectedStems' 
      }, { status: 400 })
    }

    // Get audio file details
    const { data: audioFile, error: fileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', audioFileId)
      .eq('user_id', user.id)
      .single()

    console.log('File query result:', { audioFile, fileError })

    if (fileError || !audioFile) {
      console.error('File error:', fileError)
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }

    // Verify file ownership
    if (audioFile.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Calculate audio minutes for usage tracking based on actual file duration ONLY
    if (!audioFile.duration || audioFile.duration <= 0) {
      console.error(`No valid duration for file ${audioFileId}. Duration: ${audioFile.duration}. Cannot proceed with separation.`)
      return NextResponse.json({ 
        error: 'Audio file duration not available. Please re-upload the file.' 
      }, { status: 400 })
    }
    
    // Convert seconds to minutes with precise calculation (no rounding up for tiny files)
    const audioMinutes = Math.max(0.1, Number((audioFile.duration / 60).toFixed(1)))
    console.log(`Precise audio duration: ${audioFile.duration}s = ${audioMinutes} minutes`)

    // For credit calculation - use precise duration in minutes (no rounding)
    const preciseDurationMinutes = audioFile.duration / 60
    console.log(`Precise duration for credits: ${preciseDurationMinutes} minutes`)

    // Use precise duration for validation (not rounded up)
    const validationDurationMinutes = preciseDurationMinutes
    
    // Add diagnostic logging for validation
    console.log('About to validate operation with params:', {
      userId: user.id,
      stems: selectedStems,
      durationMinutes: validationDurationMinutes,
      model: 'htdemucs',
      fileSize: audioFile.file_size
    })
    
    const validation = await validateUserOperation(user.id, {
      stems: selectedStems as any[],
      durationMinutes: validationDurationMinutes,
      model: 'htdemucs' as any,
      fileSize: audioFile.file_size
    }, supabase)

    console.log('Validation result:', validation)

    if (!validation.success) {
      console.error('Validation failed:', {
        message: validation.message,
        creditsRemaining: validation.creditsRemaining,
        creditsRequired: validation.creditsRequired,
        tier: validation.tier
      })
      return NextResponse.json({ 
        error: validation.message,
        code: 'VALIDATION_FAILED'
      }, { status: 400 })
    }

    console.log('Validation passed successfully')

    // Get audio file public URL
    const { data: publicUrlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(audioFile.storage_path)
    
    const audioUrl = publicUrlData.publicUrl
    console.log('Using public URL:', audioUrl)

    if (!audioUrl) {
      return NextResponse.json({ 
        error: 'Failed to get audio file URL' 
      }, { status: 500 })
    }

    // Create separation job record
    const jobData = {
      user_id: user.id,
      audio_file_id: audioFileId,
      status: 'pending' as const,
      selected_stems: selectedStems,
      quality,
      progress: 0,
      created_at: new Date().toISOString()
    }

    const { data: separationJob, error: jobError } = await supabase
      .from('separation_jobs')
      .insert(jobData)
      .select()
      .single()

    if (jobError) {
      console.error('Failed to create separation job:', jobError)
      return NextResponse.json({ 
        error: 'Failed to create separation job' 
      }, { status: 500 })
    }

    // Call Python Sieve API service
    try {
      console.log('Calling Python Sieve API service...')
      
      // Get Python API URL from environment
      const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000'
      
      // Simple payload for Python service - let it handle the Sieve-specific logic
      const pythonPayload = {
        audio_url: audioUrl,
        selected_stems: selectedStems,
        quality: quality
      }
      
      console.log('Calling Python API with payload:', JSON.stringify(pythonPayload, null, 2))
      
      const pythonResponse = await fetch(`${pythonApiUrl}/separate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pythonPayload)
      })

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text()
        console.error('Python API error response:', errorText)
        throw new Error(`Python API error: ${pythonResponse.status} ${pythonResponse.statusText}`)
      }

      const pythonResult = await pythonResponse.json()
      console.log('Python API response:', pythonResult)
      console.log('Python result status:', pythonResult.status)
      console.log('Python result output_files exists:', !!pythonResult.output_files)
      console.log('Python result output_files length:', pythonResult.output_files?.length || 0)

      // Check if we got completed results synchronously
      if (pythonResult.status === 'completed' && pythonResult.output_files) {
        console.log('✅ SYNCHRONOUS COMPLETION DETECTED - Processing results immediately')
        console.log('Received completed separation results from Python API')
        
        // Process the output files into our result format
        const resultFiles = []
        for (const outputFile of pythonResult.output_files) {
          if (outputFile.url) {
            resultFiles.push({
              stem: outputFile.stem_name,
              url: outputFile.url,
              size: 0
            })
          }
        }
        
        console.log('Processed result files:', resultFiles)
        
        // Calculate and deduct credits
        const creditsCalculation = calculateCreditsRequired(
          selectedStems as any[],
          preciseDurationMinutes,
          quality === 'pro' ? 'htdemucs_ft' : 'htdemucs'
        )
        
        // Round credits to 2 decimal places for database storage
        const creditsToUse = Math.round(creditsCalculation.totalCost * 100) / 100
        
        console.log('Credits calculation:', {
          baseCost: creditsCalculation.baseCost,
          modelMultiplier: creditsCalculation.modelMultiplier,
          totalCost: creditsCalculation.totalCost,
          roundedCredits: creditsToUse
        })
        
        const creditResult = await deductCredits(
          user.id,
          creditsToUse,
          separationJob.id,
          `Audio separation: ${selectedStems.length} stems, ${preciseDurationMinutes} min`,
          supabase
        )
        
        console.log('Credit deduction result:', creditResult)
        
        // Update job to completed status
        console.log('UPDATING DATABASE: Preparing to update job to completed status')
        console.log('Job ID:', separationJob.id)
        console.log('Result files to save:', JSON.stringify(resultFiles, null, 2))
        console.log('Credits to save:', creditsToUse)
        
        const updateData = {
          status: 'completed',
          progress: 100,
          result_files: resultFiles,
          credits_used: creditsToUse,
          completed_at: new Date().toISOString()
        }
        console.log('Update data object:', JSON.stringify(updateData, null, 2))
        
        const { data: updateResult, error: updateError } = await supabase
          .from('separation_jobs')
          .update(updateData)
          .eq('id', separationJob.id)
          .select()

        if (updateError) {
          console.error('DATABASE UPDATE FAILED:', updateError)
          console.error('Update error details:', JSON.stringify(updateError, null, 2))
          throw new Error(`Failed to update job status: ${updateError.message}`)
        }
        
        console.log('DATABASE UPDATE SUCCESS:', updateResult)
        console.log('Updated job data:', JSON.stringify(updateResult, null, 2))

        // Record usage in cumulative tracking system
        try {
          console.log(`Recording audio usage: ${audioMinutes} minutes for user ${user.id}`)
          
          // Use server-side supabase client for RPC calls
          const { error: audioUsageError } = await supabase.rpc('record_audio_usage', {
            p_user_id: user.id,
            p_audio_minutes: audioMinutes
          })
          
          if (audioUsageError) {
            console.error('Audio usage RPC error:', audioUsageError)
            throw audioUsageError
          }
          
          console.log(`Recording separation usage for user ${user.id}`)
          const { error: separationUsageError } = await supabase.rpc('record_separation_usage', {
            p_user_id: user.id
          })
          
          if (separationUsageError) {
            console.error('Separation usage RPC error:', separationUsageError)
            throw separationUsageError
          }
          
          console.log(`Successfully recorded usage: ${audioMinutes} minutes, 1 separation for user ${user.id}`)
        } catch (usageError) {
          console.error('Failed to record usage tracking:', usageError)
          // Don't fail the whole operation for usage tracking errors, but log it prominently
          console.error('CRITICAL: Usage tracking failed - manual correction may be needed')
        }

        return NextResponse.json({
          success: true,
          jobId: separationJob.id,
          status: 'completed',
          progress: 100,
          resultFiles: resultFiles,
          message: 'Separation completed successfully'
        })
      }

      // Fallback: Extract job ID from Python API response (for async flow)
      const sieveJobId = pythonResult.job_id
      
      if (!sieveJobId && pythonResult.status !== 'completed') {
        throw new Error('No job ID returned from Python API and separation not completed')
      }

      // Update job with Sieve job ID
      await supabase
        .from('separation_jobs')
        .update({ 
          status: 'processing',
          progress: 10,
          sieve_job_id: sieveJobId
        })
        .eq('id', separationJob.id)

      // Return job ID for status polling
      return NextResponse.json({
        success: true,
        jobId: separationJob.id,
        sieveJobId: sieveJobId,
        status: 'processing',
        message: 'Separation job started successfully'
      })

    } catch (pythonApiError) {
      console.error('Python API error:', pythonApiError)
      
      // Update job status to failed
      await supabase
        .from('separation_jobs')
        .update({
          status: 'failed',
          error_message: pythonApiError instanceof Error ? pythonApiError.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', separationJob.id)

      return NextResponse.json({ 
        error: 'Failed to start separation process',
        details: pythonApiError instanceof Error ? pythonApiError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Separation API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// GET endpoint for job status
export async function GET(request: NextRequest) {
  try {
    // Create Supabase server client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {},
          remove() {}
        }
      }
    )

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 })
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    // Extract the token and set session
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Set the session for RLS
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: ''
    })

    // Get job status from database
    const { data: job, error: jobError } = await supabase
      .from('separation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Verify job ownership
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // If job is still processing and we have a Sieve job ID, check Python API status
    if ((job.status === 'pending' || job.status === 'processing') && job.sieve_job_id) {
      try {
        console.log('Checking Python API job status for:', job.sieve_job_id)
        
        const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000'
        const statusResponse = await fetch(`${pythonApiUrl}/status/${job.sieve_job_id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (statusResponse.ok) {
          const statusResult = await statusResponse.json()
          
          console.log('Python API status response:', statusResult)
          
          // Map Python API status to our format
          let status = job.status
          let progress = job.progress
          
          if (statusResult.status === 'completed') {
            status = 'completed'
            progress = 100
          } else if (statusResult.status === 'failed') {
            status = 'failed'
            progress = 0
          } else if (statusResult.status === 'processing') {
            status = 'processing'
            progress = 60
          }
          
          // Update our database with status
          const updateData: any = {
            status,
            progress
          }

          if (statusResult.status === 'completed' && statusResult.result) {
            // Process results from Python API
            const resultFiles = []
            const result = statusResult.result
            
            if (Array.isArray(result)) {
              // Multiple files (list of stems)
              const stemNames = ['vocals', 'drums', 'bass', 'other', 'guitar', 'piano']
              for (let i = 0; i < result.length; i++) {
                const stemFile = result[i]
                if (stemFile && (stemFile.url || stemFile.file_url)) {
                  const stemName = stemNames[i] || `stem_${i}`
                  resultFiles.push({
                    name: stemName,
                    url: stemFile.url || stemFile.file_url
                  })
                }
              }
            } else if (result && (result.url || result.file_url)) {
              // Single file result
              resultFiles.push({
                name: 'separated',
                url: result.url || result.file_url
              })
            }
            
            updateData.result_files = resultFiles
            updateData.completed_at = new Date().toISOString()

            // Record usage analytics when job completes asynchronously
            try {
              console.log('Recording usage analytics for async completion...')
              
              // Get the audio file details to calculate minutes
              const { data: audioFile, error: audioFileError } = await supabase
                .from('audio_files')
                .select('duration')
                .eq('id', job.audio_file_id)
                .single()

              if (audioFileError || !audioFile) {
                console.error('Failed to get audio file for usage tracking:', audioFileError)
              } else if (audioFile.duration && audioFile.duration > 0) {
                // Convert seconds to minutes with precise calculation
                const audioMinutes = Math.max(0.1, Number((audioFile.duration / 60).toFixed(1)))
                console.log(`Recording async usage: ${audioMinutes} minutes for user ${user.id}`)
                
                // Record audio usage
                const { error: audioUsageError } = await supabase.rpc('record_audio_usage', {
                  p_user_id: user.id,
                  p_audio_minutes: audioMinutes
                })
                
                if (audioUsageError) {
                  console.error('Audio usage RPC error (async):', audioUsageError)
                } else {
                  console.log('Successfully recorded audio usage (async)')
                }
                
                // Record separation usage
                const { error: separationUsageError } = await supabase.rpc('record_separation_usage', {
                  p_user_id: user.id
                })
                
                if (separationUsageError) {
                  console.error('Separation usage RPC error (async):', separationUsageError)
                } else {
                  console.log('Successfully recorded separation usage (async)')
                }
              } else {
                console.warn('No valid duration found for usage tracking')
              }
            } catch (usageError) {
              console.error('Failed to record usage tracking (async):', usageError)
              // Don't fail the status check for usage tracking errors
            }
          } else if (statusResult.status === 'failed') {
            updateData.error_message = statusResult.error || 'Processing failed'
            updateData.completed_at = new Date().toISOString()
          }

          await supabase
            .from('separation_jobs')
            .update(updateData)
            .eq('id', jobId)

          // Update our local job object
          Object.assign(job, updateData)
        } else {
          console.error('Failed to check Python API status:', statusResponse.status, statusResponse.statusText)
        }
      } catch (statusError) {
        console.error('Error checking Python API status:', statusError)
        // Continue with database status if Python API check fails
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      selectedStems: job.selected_stems,
      quality: job.quality,
      resultFiles: job.result_files,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      completedAt: job.completed_at
    })

  } catch (error) {
    console.error('Job status API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 