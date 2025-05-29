import { createClient } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  success: boolean
  fileUrl?: string
  filePath?: string
  error?: string
}

export interface FileMetadata {
  id: string
  filename: string
  originalName: string
  fileSize: number
  duration?: number
  format: string
  storagePath: string
  uploadStatus: 'uploading' | 'completed' | 'failed'
  userId: string
}

interface AudioFileRecord {
  id: string
  file_size: number
  storage_path: string
}

interface UserSubscription {
  tier: 'free' | 'creator' | 'studio'
  processing_minutes_used: number
  processing_minutes_limit: number
  current_period_start: string
  current_period_end: string
}

interface ProcessingUsage {
  used: number
  limit: number
  tier: 'free' | 'creator' | 'studio'
  available_stems: number
  available_models: string[]
  available_formats: string[]
}

class SupabaseStorageService {
  private supabase = createClient()
  private readonly BUCKET_NAME = 'audio-files'

  /**
   * Extract accurate audio metadata using server-side analysis
   * This calls our API endpoint that uses ffprobe for production-grade metadata extraction
   */
  private async extractAudioMetadata(file: File): Promise<{ duration?: number; format?: string; bitrate?: number }> {
    try {
      // Create FormData for file upload to metadata extraction endpoint
      const formData = new FormData()
      formData.append('audio_file', file)
      
      const response = await fetch('/api/audio-metadata', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        console.warn('Server-side metadata extraction failed, falling back to client-side')
        return this.extractClientSideMetadata(file)
      }
      
      const metadata = await response.json()
      console.log('Server-side metadata extraction successful:', metadata)
      
      return {
        duration: metadata.duration,
        format: metadata.format,
        bitrate: metadata.bitrate
      }
    } catch (error) {
      console.warn('Server-side metadata extraction error:', error)
      return this.extractClientSideMetadata(file)
    }
  }

  /**
   * Fallback client-side metadata extraction using Web Audio API
   * More reliable than HTML5 audio element but less accurate than server-side
   */
  private async extractClientSideMetadata(file: File): Promise<{ duration?: number }> {
    return new Promise((resolve) => {
      const audio = new Audio()
      const url = URL.createObjectURL(file)
      
      const cleanup = () => URL.revokeObjectURL(url)
      
      const timeout = setTimeout(() => {
        console.warn('Client-side metadata extraction timed out')
        cleanup()
        resolve({})
      }, 10000)
      
      audio.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout)
        const duration = audio.duration
        
        // Validate duration with basic sanity check
        if (duration && duration > 0 && duration < 7200) { // Max 2 hours
          console.log(`Client-side duration extracted: ${duration}s`)
          cleanup()
          resolve({ duration })
        } else {
          console.warn('Invalid duration from client-side extraction')
          cleanup()
          resolve({})
        }
      })
      
      audio.addEventListener('error', () => {
        clearTimeout(timeout)
        console.warn('Client-side metadata extraction failed')
        cleanup()
        resolve({})
      })
      
      audio.crossOrigin = 'anonymous'
      audio.src = url
      audio.load()
    })
  }

  /**
   * Upload audio file to Supabase Storage
   */
  async uploadAudioFile(
    file: File,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      console.log('Starting upload for user:', userId)
      console.log('File details:', { name: file.name, size: file.size, type: file.type })

      // Generate unique filename
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      const uniqueFilename = `${uuidv4()}.${fileExtension}`
      const filePath = `${userId}/${uniqueFilename}`

      console.log('Generated file path:', filePath)

      // Create file metadata record first
      const fileMetadata: Omit<FileMetadata, 'id'> = {
        filename: uniqueFilename,
        originalName: file.name,
        fileSize: file.size,
        format: fileExtension || 'unknown',
        storagePath: filePath,
        uploadStatus: 'uploading',
        userId
      }

      console.log('Inserting file metadata:', fileMetadata)

      // Extract accurate audio metadata using server-side analysis
      const { duration, format, bitrate } = await this.extractAudioMetadata(file)

      // Insert file record into database
      const { data: fileRecord, error: dbError } = await this.supabase
        .from('audio_files')
        .insert({
          filename: fileMetadata.filename,
          original_name: fileMetadata.originalName,
          file_size: fileMetadata.fileSize,
          duration: duration,
          format: format,
          storage_path: fileMetadata.storagePath,
          upload_status: 'uploading',
          user_id: userId
        })
        .select()
        .single()

      if (dbError) {
        console.error('Database error details:', dbError)
        throw new Error(`Database error: ${dbError.message || 'Unknown database error'}`)
      }

      console.log('File record created:', fileRecord)

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error details:', uploadError)
        // Update database record to failed status
        await this.supabase
          .from('audio_files')
          .update({ upload_status: 'failed' })
          .eq('id', fileRecord.id)
        
        throw new Error(`Upload error: ${uploadError.message || 'Unknown upload error'}`)
      }

      console.log('File uploaded successfully:', uploadData)

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath)

      console.log('Public URL generated:', urlData.publicUrl)

      // Update database record to completed status
      const { error: updateError } = await this.supabase
        .from('audio_files')
        .update({ upload_status: 'completed' })
        .eq('id', fileRecord.id)

      if (updateError) {
        console.error('Update error:', updateError)
      }

      return {
        success: true,
        fileUrl: urlData.publicUrl,
        filePath: uploadData.path
      }

    } catch (error) {
      console.error('Upload failed with error:', error)
      console.error('Error type:', typeof error)
      console.error('Error constructor:', error?.constructor?.name)
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed with unknown error'
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get user's uploaded files
   */
  async getUserFiles(userId: string) {
    const { data, error } = await this.supabase
      .from('audio_files')
      .select('*')
      .eq('user_id', userId)
      .eq('upload_status', 'completed')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch files: ${error.message}`)
    }

    return data
  }

  /**
   * Delete file from storage and database with proper foreign key cascade handling
   */
  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      // Verify user session first
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.error('Authentication required for file deletion:', sessionError)
        return false
      }

      // Verify the session user matches the provided userId
      if (session.user.id !== userId) {
        console.error('User ID mismatch - unauthorized deletion attempt')
        return false
      }

      console.log('Starting cascade deletion for file:', fileId, 'user:', userId)

      // Get file record first to verify it exists
      const { data: fileRecord, error: fetchError } = await this.supabase
        .from('audio_files')
        .select('storage_path, original_name')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single()

      if (fetchError || !fileRecord) {
        console.error('File not found or fetch error:', fetchError)
        return false
      }

      console.log('File found:', fileRecord.original_name, 'storage_path:', fileRecord.storage_path)

      // Step 1: Delete credits records that reference separation jobs for this file
      console.log('Step 1: Deleting credits records...')
      
      // First, get the separation job IDs for this file
      const { data: separationJobs, error: jobsQueryError } = await this.supabase
        .from('separation_jobs')
        .select('id')
        .eq('audio_file_id', fileId)
        .eq('user_id', userId)

      if (jobsQueryError) {
        console.error('Error querying separation jobs:', jobsQueryError)
        throw new Error(`Failed to query separation jobs: ${jobsQueryError.message}`)
      }

      // Delete credits records if there are any separation jobs
      if (separationJobs && separationJobs.length > 0) {
        const jobIds = separationJobs.map(job => job.id)
        console.log('Found separation jobs to clean up:', jobIds.length)
        
        const { error: creditsDeleteError } = await this.supabase
          .from('credits')
          .delete()
          .in('separation_job_id', jobIds)

        if (creditsDeleteError) {
          console.error('Error deleting credits records:', creditsDeleteError)
          throw new Error(`Failed to delete credits records: ${creditsDeleteError.message}`)
        }
        console.log('✅ Credits records deleted successfully')
      } else {
        console.log('✅ No separation jobs found, no credits to delete')
      }

      // Step 2: Delete separation jobs that reference this audio file
      console.log('Step 2: Deleting separation jobs...')
      const { error: jobsDeleteError } = await this.supabase
        .from('separation_jobs')
        .delete()
        .eq('audio_file_id', fileId)
        .eq('user_id', userId)

      if (jobsDeleteError) {
        console.error('Error deleting separation jobs:', jobsDeleteError)
        throw new Error(`Failed to delete separation jobs: ${jobsDeleteError.message}`)
      }
      console.log('✅ Separation jobs deleted successfully')

      // Step 3: Delete from storage
      console.log('Step 3: Deleting from storage...')
      const { error: storageError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove([fileRecord.storage_path])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
        // Continue with database deletion even if storage fails
        console.log('⚠️ Storage deletion failed, continuing with database deletion')
      } else {
        console.log('✅ File deleted from storage successfully')
      }

      // Step 4: Delete the audio file record
      console.log('Step 4: Deleting audio file record...')
      const { error: dbError } = await this.supabase
        .from('audio_files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', userId)

      if (dbError) {
        console.error('Database deletion error:', dbError)
        throw new Error(`Failed to delete audio file record: ${dbError.message}`)
      }

      console.log('✅ Audio file record deleted successfully')
      console.log('🎉 Complete cascade deletion successful for file:', fileRecord.original_name)
      return true

    } catch (error) {
      console.error('❌ Cascade deletion failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown deletion error'
      console.error('Full error details:', errorMessage)
      return false
    }
  }

  /**
   * Check if file exists in storage
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .list(filePath.split('/').slice(0, -1).join('/'))

      if (error) {
        console.error('Error checking file existence:', error)
        return false
      }

      const fileName = filePath.split('/').pop()
      return data.some(file => file.name === fileName)
    } catch (error) {
      console.error('File existence check failed:', error)
      return false
    }
  }

  /**
   * Get signed URL for file download
   */
  async getDownloadUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      console.log('Attempting to create signed URL for path:', filePath)
      console.log('Using bucket:', this.BUCKET_NAME)
      
      // First check if file exists
      const exists = await this.fileExists(filePath)
      console.log('File exists in storage:', exists)
      
      if (!exists) {
        console.error('File does not exist in storage:', filePath)
        // Try to get public URL as fallback
        const { data: publicUrlData } = this.supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(filePath)
        
        console.log('Trying public URL as fallback:', publicUrlData.publicUrl)
        return publicUrlData.publicUrl
      }

      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        console.error('Failed to create signed URL:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        
        // Fallback to public URL
        const { data: publicUrlData } = this.supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(filePath)
        
        console.log('Using public URL as fallback:', publicUrlData.publicUrl)
        return publicUrlData.publicUrl
      }

      console.log('Signed URL created successfully:', data.signedUrl)
      return data.signedUrl
    } catch (error) {
      console.error('Download URL error:', error)
      
      // Last resort: try public URL
      try {
        const { data: publicUrlData } = this.supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(filePath)
        
        console.log('Using public URL as last resort:', publicUrlData.publicUrl)
        return publicUrlData.publicUrl
      } catch (publicError) {
        console.error('Public URL also failed:', publicError)
        return null
      }
    }
  }

  /**
   * Get user's processing time usage and limits
   */
  async getProcessingUsage(userId: string): Promise<ProcessingUsage> {
    // For now, return default free tier values
    // TODO: Integrate with actual subscription management
    return {
      used: 0, // Will be calculated from completed processing jobs
      limit: 5, // 5 minutes for free tier
      tier: 'free',
      available_stems: 4, // vocals, drums, bass, other
      available_models: ['htdemucs'], // standard model only
      available_formats: ['mp3'] // MP3 only for free
    }
  }

  /**
   * Check if user can start a processing job
   */
  async canProcessAudio(userId: string, estimatedMinutes: number): Promise<{ canProcess: boolean; reason?: string }> {
    const usage = await this.getProcessingUsage(userId)
    
    if (usage.used + estimatedMinutes > usage.limit) {
      return {
        canProcess: false,
        reason: `Not enough processing minutes. You have ${usage.limit - usage.used} minutes remaining.`
      }
    }
    
    return { canProcess: true }
  }

  /**
   * Track processing time usage
   */
  async recordProcessingUsage(userId: string, minutesUsed: number): Promise<boolean> {
    try {
      // TODO: Record processing usage in database
      // For now, just return success
      return true
    } catch (error) {
      console.error('Failed to record processing usage:', error)
      return false
    }
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(userId: string): Promise<void> {
    try {
      // Get expired files
      const { data: expiredFiles, error } = await this.supabase
        .from('audio_files')
        .select('id, storage_path')
        .eq('user_id', userId)
        .lt('expires_at', new Date().toISOString())

      if (error || !expiredFiles?.length) {
        return
      }

      // Delete expired files
      for (const file of expiredFiles) {
        await this.deleteFile(file.id, userId)
      }
    } catch (error) {
      console.error('Cleanup failed:', error)
    }
  }
}

export const storageService = new SupabaseStorageService() 