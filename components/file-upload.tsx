"use client"

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AUDIO_CONFIG } from '@/lib/constants'
import { storageService, type UploadResult } from '@/lib/supabase-storage'
import { useAuth } from '@/components/auth-provider'
import { subscriptionService } from '@/lib/subscription-limits'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect?: (file: File) => void
  onUploadComplete?: (result: UploadResult) => void
  className?: string
  disabled?: boolean
}

interface FileValidation {
  isValid: boolean
  errors: string[]
}

interface AudioMetadata {
  name: string
  size: number
  duration?: number
  type: string
  lastModified: number
}

export function FileUpload({ 
  onFileSelect, 
  onUploadComplete, 
  className, 
  disabled = false 
}: FileUploadProps) {
  const { user } = useAuth()
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Validate file before processing
  const validateFile = useCallback((file: File): FileValidation => {
    const errors: string[] = []
    
    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !AUDIO_CONFIG.supportedFormats.includes(fileExtension as any)) {
      errors.push(`Unsupported file format. Please use: ${AUDIO_CONFIG.supportedFormats.join(', ').toUpperCase()}`)
    }
    
    // Check file size
    if (file.size > AUDIO_CONFIG.maxFileSize) {
      const maxSizeMB = AUDIO_CONFIG.maxFileSize / (1024 * 1024)
      errors.push(`File too large. Maximum size is ${maxSizeMB}MB`)
    }
    
    // Check if file is empty
    if (file.size === 0) {
      errors.push('File is empty')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }, [])

  // Extract basic file metadata (no duration - handled server-side now)
  const extractFileMetadata = useCallback(async (file: File): Promise<AudioMetadata> => {
    // Return basic metadata - duration will be extracted server-side during upload
    const metadata: AudioMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
      // duration removed - will be extracted accurately server-side
    }
    
    console.log('File metadata prepared for server-side analysis:', metadata)
    return metadata
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    const validation = validateFile(file)
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors)
      setSelectedFile(null)
      setAudioMetadata(null)
      return
    }

    setValidationErrors([])
    setSelectedFile(file)
    setUploadResult(null)
    
    // Extract metadata
    const metadata = await extractFileMetadata(file)
    setAudioMetadata(metadata)
    
    // Note: Duration validation now handled server-side during upload for accuracy
    
    onFileSelect?.(file)
  }, [validateFile, extractFileMetadata, onFileSelect])

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (disabled) return
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [disabled, handleFileSelect])

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Handle upload to Supabase
  const handleUpload = useCallback(async () => {
    if (!selectedFile || !user) {
      setValidationErrors(['Please sign in to upload files'])
      return
    }
    
    setIsUploading(true)
    setUploadProgress(0)
    setValidationErrors([])
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      // Upload to Supabase
      const result = await storageService.uploadAudioFile(
        selectedFile,
        user.id,
        (progress) => {
          setUploadProgress(progress.percentage)
        }
      )

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadResult(result)

      if (result.success) {
        // Record file upload usage in cumulative tracking
        try {
          await subscriptionService.recordFileUploadUsage(user.id)
          console.log(`Recorded file upload usage for user ${user.id}`)
        } catch (usageError) {
          console.error('Failed to record file upload usage:', usageError)
          // Don't fail the upload for usage tracking errors
        }
        
        onUploadComplete?.(result)
      } else {
        setValidationErrors([result.error || 'Upload failed'])
      }
      
    } catch (error) {
      console.error('Upload failed:', error)
      setValidationErrors(['Upload failed. Please try again.'])
    } finally {
      setIsUploading(false)
    }
  }, [selectedFile, user, onUploadComplete])

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedFile(null)
    setAudioMetadata(null)
    setValidationErrors([])
    setUploadProgress(0)
    setUploadResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Upload Area */}
      <Card 
        className={cn(
          "border-2 border-dashed transition-all duration-300 cursor-pointer",
          isDragOver 
            ? "border-accent bg-accent/5 scale-[1.02]" 
            : "border-gray-300 dark:border-gray-600 hover:border-accent/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <CardContent className="p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept={AUDIO_CONFIG.supportedFormats.map(f => `.${f}`).join(',')}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
          />
          
          {!selectedFile ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18.75 19.5H6.75Z"/>
                </svg>
              </div>
              <h3 className="text-lg font-heading font-semibold mb-2 text-foreground">
                Drop your audio file here
              </h3>
              <p className="text-muted-foreground mb-4 font-sans">
                or click to browse files
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {AUDIO_CONFIG.supportedFormats.map((format) => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {format.toUpperCase()}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground font-sans">
                Maximum file size: {AUDIO_CONFIG.maxFileSize / (1024 * 1024)}MB
              </p>
            </>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-center space-x-3">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-heading font-semibold text-foreground">{audioMetadata?.name}</p>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground font-mono">
                    <span>{formatFileSize(audioMetadata?.size || 0)}</span>
                    {audioMetadata?.duration && (
                      <span>{formatDuration(audioMetadata.duration)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground font-sans">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Upload Result */}
              {uploadResult && (
                <div className={cn(
                  "p-3 rounded-lg text-sm font-sans",
                  uploadResult.success 
                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                )}>
                  {uploadResult.success ? (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>File uploaded successfully!</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                      <span>{uploadResult.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center space-x-3">
                {!uploadResult?.success && (
                  <Button 
                    onClick={handleUpload}
                    disabled={isUploading || !user}
                    className="bg-accent hover:bg-accent/90 text-white"
                  >
                    {isUploading ? 'Uploading...' : 'Upload File'}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={handleClear}
                  disabled={isUploading}
                >
                  {uploadResult?.success ? 'Upload Another' : 'Clear'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          {validationErrors.map((error, index) => (
            <p key={index} className="text-sm text-red-700 dark:text-red-300 font-sans">
              {error}
            </p>
          ))}
        </div>
      )}
    </div>
  )
} 