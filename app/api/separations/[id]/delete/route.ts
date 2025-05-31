import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create service role client inline to avoid import issues
const createServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    console.log('=== SERVER-SIDE SEPARATION DELETION ===')
    console.log('Job ID:', jobId)

    // Get Authorization header
    const authHeader = request.headers.get('authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authentication required - missing Bearer token' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    console.log('Token extracted, length:', token.length)

    // Create authenticated Supabase client using the token
    const supabase = createClient()
    
    // Set the session using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Authentication error:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log('Authenticated user:', user.id)

    // Create service role client for admin operations
    const adminSupabase = createServiceRoleClient()

    // Step 1: Verify job ownership and get job details
    console.log('Step 1: Verifying job ownership...')
    const { data: jobDetails, error: jobFetchError } = await adminSupabase
      .from('separation_jobs')
      .select(`
        *,
        audio_files:audio_file_id (
          id,
          storage_path,
          original_name
        )
      `)
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobFetchError || !jobDetails) {
      console.error('Job fetch error:', jobFetchError)
      return NextResponse.json(
        { error: 'Separation not found or access denied' },
        { status: 404 }
      )
    }

    console.log('Job verified:', {
      jobId: jobDetails.id,
      audioFileId: jobDetails.audio_file_id,
      resultFiles: jobDetails.result_files?.length || 0,
      userId: jobDetails.user_id
    })

    // Step 2: Delete result files from storage
    if (jobDetails.result_files && jobDetails.result_files.length > 0) {
      console.log(`Step 2: Deleting ${jobDetails.result_files.length} result files from storage...`)
      
      const filesToDelete: string[] = []
      
      for (const resultFile of jobDetails.result_files) {
        try {
          if (resultFile.url && resultFile.url.includes('supabase.co/storage')) {
            // Extract storage path from URL
            const urlParts = resultFile.url.split('/storage/v1/object/public/audio-files/')
            if (urlParts.length > 1) {
              const storagePath = urlParts[1]
              filesToDelete.push(storagePath)
              console.log(`Queued for deletion: ${storagePath}`)
            }
          }
        } catch (error) {
          console.error('Error parsing result file URL:', error)
        }
      }
      
      if (filesToDelete.length > 0) {
        const { error: storageDeleteError } = await adminSupabase.storage
          .from('audio-files')
          .remove(filesToDelete)
        
        if (storageDeleteError) {
          console.error('Storage deletion error:', storageDeleteError)
          // Don't fail the whole operation for storage errors
        } else {
          console.log(`Successfully deleted ${filesToDelete.length} storage files`)
        }
      }
    } else {
      console.log('Step 2: No result files to delete from storage')
    }

    // Step 3: Delete credits records (with admin privileges)
    console.log('Step 3: Deleting credits records...')
    const { data: creditsToDelete, error: creditsCheckError } = await adminSupabase
      .from('credits')
      .select('id, amount, description')
      .eq('separation_job_id', jobId)

    if (creditsCheckError) {
      console.error('Credits check error:', creditsCheckError)
      return NextResponse.json(
        { error: `Failed to check credits: ${creditsCheckError.message}` },
        { status: 500 }
      )
    }

    if (creditsToDelete && creditsToDelete.length > 0) {
      console.log(`Found ${creditsToDelete.length} credits records:`, creditsToDelete)
      
      const { error: creditsDeleteError } = await adminSupabase
        .from('credits')
        .delete()
        .eq('separation_job_id', jobId)

      if (creditsDeleteError) {
        console.error('Credits deletion error:', creditsDeleteError)
        return NextResponse.json(
          { error: `Failed to delete credits: ${creditsDeleteError.message}` },
          { status: 500 }
        )
      }

      console.log('Successfully deleted all credits records')
    } else {
      console.log('No credits records found')
    }

    // Step 4: Delete the separation job (with admin privileges but user verification)
    console.log('Step 4: Deleting separation job...')
    const { error: jobDeleteError } = await adminSupabase
      .from('separation_jobs')
      .delete()
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user owns the job

    if (jobDeleteError) {
      console.error('Job deletion error:', jobDeleteError)
      return NextResponse.json(
        { error: `Failed to delete separation: ${jobDeleteError.message}` },
        { status: 500 }
      )
    }

    console.log('=== SEPARATION DELETION COMPLETED SUCCESSFULLY ===')

    return NextResponse.json({
      success: true,
      message: 'Separation and all associated data deleted successfully',
      deletedJobId: jobId
    })

  } catch (error) {
    console.error('=== UNEXPECTED ERROR IN SEPARATION DELETION ===')
    console.error('Error details:', error)
    
    return NextResponse.json(
      { error: 'Internal server error during deletion' },
      { status: 500 }
    )
  }
} 