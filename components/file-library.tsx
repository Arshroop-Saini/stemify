"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { storageService } from '@/lib/supabase-storage'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/utils'
import { AudioPreview } from '@/components/audio-preview'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Unified AudioFile interface matching database structure
interface AudioFile {
  id: string
  user_id: string
  filename: string
  original_name: string
  file_size: number
  duration?: number
  format: string
  storage_path: string
  upload_status: 'uploading' | 'completed' | 'failed'
  created_at: string
  expires_at: string
}

interface ProcessingUsage {
  used: number
  limit: number
  tier: 'free' | 'creator' | 'studio'
  available_stems: number
  available_models: string[]
  available_formats: string[]
}

interface FileLibraryProps {
  onFileSelect?: (file: AudioFile) => void
  className?: string
  refreshTrigger?: number // Used to trigger refresh from parent
  selectedFile?: AudioFile | null
  onFileDeleted?: () => void
}

export function FileLibrary({ 
  onFileSelect, 
  className,
  refreshTrigger,
  selectedFile,
  onFileDeleted
}: FileLibraryProps) {
  const { user } = useAuth()
  const [files, setFiles] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filesPerPage] = useState(3)

  // Pagination calculations
  const totalPages = Math.ceil(files.length / filesPerPage)
  const startIndex = (currentPage - 1) * filesPerPage
  const endIndex = startIndex + filesPerPage
  const currentFiles = files.slice(startIndex, endIndex)

  // Reset to first page when files change
  useEffect(() => {
    setCurrentPage(1)
  }, [files.length])

  // Pagination handlers
  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages))
  }

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1))
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // Load user files and processing usage
  const loadFiles = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      
      const [userFiles, usage] = await Promise.all([
        storageService.getUserFiles(user.id),
        storageService.getProcessingUsage(user.id)
      ])
      
      setFiles(userFiles)
    } catch (err) {
      console.error('Failed to load files:', err)
      setError('Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Load files on mount and when refresh trigger changes
  useEffect(() => {
    loadFiles()
  }, [loadFiles, refreshTrigger])

  // Handle file selection
  const handleFileSelect = useCallback((file: AudioFile) => {
    console.log('File selected in library:', file)
    console.log('File ID being set:', file.id)
    onFileSelect?.(file)
  }, [onFileSelect])

  // Handle file deletion
  const handleDeleteFile = useCallback(async (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (!user || !confirm('Are you sure you want to delete this file?')) return

    try {
      setDeletingFileId(fileId)
      const success = await storageService.deleteFile(fileId, user.id)
      
      if (success) {
        setFiles(prev => prev.filter(f => f.id !== fileId))
        if (selectedFile?.id === fileId) {
          onFileDeleted?.()
        }
        
        toast.success('File deleted successfully')
      } else {
        setError('Failed to delete file')
        toast.error('Failed to delete file')
      }
    } catch (err) {
      console.error('Delete failed:', err)
      setError('Failed to delete file')
    } finally {
      setDeletingFileId(null)
    }
  }, [user, selectedFile, onFileDeleted, onFileSelect])

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

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground font-sans">Please sign in to view your files</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* File List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Your Audio Files</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
              <p className="text-muted-foreground mt-2 font-sans">Loading files...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 font-sans">{error}</p>
              <Button 
                onClick={loadFiles} 
                className="mt-4"
                variant="outline"
                size="sm"
              >
                Try Again
              </Button>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/>
                </svg>
              </div>
              <h3 className="text-lg font-heading font-medium text-foreground mb-2">No files yet</h3>
              <p className="text-muted-foreground font-sans">Upload your first audio file to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "p-4 rounded-lg border-2 cursor-pointer transition-all hover:bg-muted/50",
                    selectedFile?.id === file.id 
                      ? "border-accent bg-accent/5" 
                      : "border-border hover:border-accent/50"
                  )}
                  onClick={() => handleFileSelect(file)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/>
                        </svg>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-medium text-foreground truncate">
                          {file.original_name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatFileSize(file.file_size)}
                          </span>
                          {file.duration && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatDuration(file.duration)}
                              </span>
                            </>
                          )}
                          <span className="text-xs text-muted-foreground">•</span>
                          <Badge variant="secondary" className="text-xs">
                            {file.format.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-sans">
                          Uploaded {formatDate(file.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {selectedFile?.id === file.id && (
                        <Badge variant="default" className="text-xs">
                          Selected
                        </Badge>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/50"
                        onClick={(e) => handleDeleteFile(file.id, e)}
                        disabled={deletingFileId === file.id}
                      >
                        {deletingFileId === file.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {files.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, files.length)} of {files.length} files
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

{/* Audio Preview Section removed as per user request */}
    </div>
  )
} 