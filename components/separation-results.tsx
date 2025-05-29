"use client"

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Download, Play, Pause, Calendar, Clock, Music, ChevronDown, ChevronRight, Trash2, MoreVertical, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import WaveSurfer from 'wavesurfer.js'

interface SeparationJob {
  id: string
  audio_file_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  selected_stems: string[]
  quality: 'standard' | 'pro'
  progress: number
  result_files?: Array<{
    stem: string
    url: string
    size?: number
    name?: string  // For backward compatibility
  }>
  credits_used: number
  created_at: string
  completed_at?: string
  audio_files?: {
    original_name: string
    duration?: number
  }
}

interface MonthGroup {
  month: string
  year: number
  jobs: SeparationJob[]
}

// Individual stem player component
function StemPlayer({ stem, url, filename }: { stem: string; url: string; filename: string }) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Color mapping for different stems
  const stemColors = {
    vocals: '#22C55E',    // Green
    drums: '#EF4444',     // Red  
    bass: '#8B5CF6',      // Purple
    other: '#3B82F6',     // Blue
    guitar: '#F59E0B',    // Orange
    piano: '#EC4899',     // Pink
    no_vocals: '#6B7280', // Gray
    no_drums: '#6B7280',  // Gray
    no_bass: '#6B7280',   // Gray
    no_other: '#6B7280'   // Gray
  }

  const stemColor = stemColors[stem as keyof typeof stemColors] || '#6B7280'

  useEffect(() => {
    // Auto-initialize waveform when component mounts
    if (url && waveformRef.current && !wavesurfer.current) {
      initializeWaveform()
    }
    
    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
        wavesurfer.current = null
      }
    }
  }, [url])

  const initializeWaveform = async () => {
    if (!waveformRef.current || wavesurfer.current || !url) return

    setIsLoading(true)
    setError(null)
    
    try {
      // Clear any existing waveform
      if (wavesurfer.current) {
        try {
          (wavesurfer.current as any).destroy()
        } catch (e) {
          // Ignore destroy errors
        }
      }

      // Clean the URL - remove trailing ? or other issues
      const cleanUrl = url.endsWith('?') ? url.slice(0, -1) : url
      console.log(`Testing audio accessibility for ${stem}:`, cleanUrl)

      // First, test if the URL is actually accessible
      try {
        const testResponse = await fetch(cleanUrl, { 
          method: 'HEAD',
          mode: 'cors'
        })
        console.log(`URL test for ${stem}:`, testResponse.status, testResponse.statusText)
        
        if (!testResponse.ok) {
          throw new Error(`HTTP ${testResponse.status}: ${testResponse.statusText}`)
        }
      } catch (fetchError) {
        console.error(`URL not accessible for ${stem}:`, fetchError)
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error'
        setError(`File not accessible: ${errorMessage}`)
        setIsLoading(false)
        return
      }

      // Try a simple HTML5 audio test first
      const testAudio = new Audio()
      testAudio.crossOrigin = 'anonymous'
      
      const audioTestPromise = new Promise((resolve, reject) => {
        testAudio.addEventListener('canplaythrough', resolve, { once: true })
        testAudio.addEventListener('error', reject, { once: true })
        testAudio.addEventListener('loadstart', () => console.log(`Audio loading started for ${stem}`))
        testAudio.addEventListener('loadedmetadata', () => console.log(`Audio metadata loaded for ${stem}`))
        testAudio.src = cleanUrl
      })

      try {
        await audioTestPromise
        console.log(`HTML5 audio test passed for ${stem}`)
      } catch (audioError) {
        console.error(`HTML5 audio test failed for ${stem}:`, audioError)
        setError(`Audio format not supported`)
        setIsLoading(false)
        return
      }

      // If we get here, the audio should work, so create WaveSurfer
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: stemColor + '40',
        progressColor: stemColor,
        height: 40,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        cursorWidth: 2,
        cursorColor: stemColor,
        mediaControls: false,
        interact: true
      })

      // Set up event listeners
      wavesurfer.current.on('ready', () => {
        setDuration(wavesurfer.current?.getDuration() || 0)
        setIsLoading(false)
        console.log(`WaveSurfer ready for ${stem}, duration:`, wavesurfer.current?.getDuration())
      })

      wavesurfer.current.on('audioprocess', () => {
        setCurrentTime(wavesurfer.current?.getCurrentTime() || 0)
      })

      wavesurfer.current.on('play', () => {
        setIsPlaying(true)
        console.log(`WaveSurfer playing ${stem}`)
      })
      
      wavesurfer.current.on('pause', () => {
        setIsPlaying(false)
        console.log(`WaveSurfer paused ${stem}`)
      })

      wavesurfer.current.on('finish', () => {
        setIsPlaying(false)
        console.log(`WaveSurfer finished ${stem}`)
      })

      wavesurfer.current.on('error', (err) => {
        console.error(`WaveSurfer error for ${stem}:`, err)
        setError(`Waveform error`)
        setIsLoading(false)
      })

      console.log(`Loading waveform for ${stem}...`)
      await wavesurfer.current.load(cleanUrl)
      
    } catch (error) {
      console.error(`Critical error initializing waveform for ${stem}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to initialize: ${errorMessage}`)
      setIsLoading(false)
    }
  }

  const togglePlayPause = async () => {
    if (!wavesurfer.current) {
      console.log(`No waveform for ${stem}, initializing...`)
      await initializeWaveform()
      return
    }

    try {
      if (isPlaying) {
        wavesurfer.current.pause()
      } else {
        await wavesurfer.current.play()
      }
    } catch (error) {
      console.error(`Error toggling playback for ${stem}:`, error)
      setError('Playback error')
    }
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      
      toast.success(`Downloaded ${filename}`)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download file')
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="border rounded-lg p-3 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: stemColor }}
          />
          <span className="font-medium text-sm capitalize">{stem.replace('_', ' ')}</span>
          {error && (
            <span className="text-xs text-red-500">⚠️</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className="h-8 w-8 p-0"
            style={{ color: stemColor }}
          >
            {isLoading ? (
              <div className="w-4 h-4 animate-spin border-2 border-gray-300 border-t-current rounded-full" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
            style={{ color: stemColor }}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="h-10 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center justify-center">
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div 
            ref={waveformRef} 
            className="cursor-pointer min-h-[40px] rounded"
          />
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{formatTime(currentTime)}</span>
            {isLoading && <span className="text-gray-400">Loading audio...</span>}
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function SeparationResults() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<SeparationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([])
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user) {
      fetchSeparationHistory()
    }
  }, [user])

  useEffect(() => {
    groupJobsByMonth(jobs)
  }, [jobs])

  const groupJobsByMonth = (jobList: SeparationJob[]) => {
    const grouped = jobList.reduce((acc, job) => {
      const date = new Date(job.created_at)
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      const monthName = date.toLocaleDateString('en-US', { month: 'long' })
      const year = date.getFullYear()

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthName,
          year,
          jobs: []
        }
      }
      acc[monthKey].jobs.push(job)
      return acc
    }, {} as Record<string, MonthGroup>)

    const sortedGroups = Object.values(grouped).sort((a, b) => {
      // Sort by year desc, then by month desc
      if (a.year !== b.year) return b.year - a.year
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December']
      return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month)
    })

    setMonthGroups(sortedGroups)

    // Auto-open current month
    if (sortedGroups.length > 0) {
      const currentMonth = `${sortedGroups[0].year}-${sortedGroups[0].month}`
      setOpenMonths(new Set([currentMonth]))
    }
  }

  const fetchSeparationHistory = async () => {
    if (!user) return

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('separation_jobs')
        .select(`
          *,
          audio_files:audio_file_id (
            original_name,
            duration
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setJobs(data || [])
    } catch (error) {
      console.error('Error fetching separation history:', error)
      toast.error('Failed to load separation history')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    try {
      const supabase = createClient()
      
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        toast.error('Authentication required')
        return
      }

      // Delete the separation job with proper auth context
      const { error } = await supabase
        .from('separation_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user?.id)

      if (error) {
        console.error('Delete error details:', error)
        throw error
      }

      // Update local state
      setJobs(prev => prev.filter(job => job.id !== jobId))
      toast.success('Separation deleted successfully')
      
      // Also refresh the data to ensure consistency
      setTimeout(() => {
        fetchSeparationHistory()
      }, 500)
      
    } catch (error) {
      console.error('Error deleting separation:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to delete separation: ${errorMessage}`)
    }
  }

  const toggleMonth = (monthKey: string) => {
    setOpenMonths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey)
      } else {
        newSet.add(monthKey)
      }
      return newSet
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Sign in to view results
            </h3>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Separation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Separation History
          <Badge variant="secondary" className="ml-auto">
            {jobs.length} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {monthGroups.length === 0 ? (
          <div className="text-center py-8">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No separations yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Upload an audio file and start your first separation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {monthGroups.map((group) => {
              const monthKey = `${group.year}-${group.month}`
              const isOpen = openMonths.has(monthKey)
              
              return (
                <Collapsible key={monthKey} open={isOpen} onOpenChange={() => toggleMonth(monthKey)}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {group.month} {group.year}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {group.jobs.length} separations
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-3 pl-6">
                      {group.jobs.map((job) => (
                        <Card key={job.id} className="bg-gray-50 dark:bg-gray-800">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                  {job.audio_files?.original_name || 'Unknown file'}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(job.created_at)}
                                  </span>
                                  <span>{job.selected_stems.length} stems</span>
                                  <span className="capitalize">{job.quality} quality</span>
                                  {job.audio_files?.duration && (
                                    <span>{formatDuration(job.audio_files.duration)}</span>
                                  )}
                                  <span>{job.credits_used} credits</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  job.status === 'completed' ? 'default' :
                                  job.status === 'failed' ? 'destructive' :
                                  job.status === 'processing' ? 'secondary' :
                                  'outline'
                                }>
                                  {job.status}
                                </Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteJob(job.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {job.status === 'processing' && (
                              <div className="mb-3">
                                <Progress value={job.progress} className="w-full" />
                                <div className="text-xs text-gray-500 mt-1">
                                  {job.progress}% complete
                                </div>
                              </div>
                            )}

                            {job.status === 'completed' && job.result_files && job.result_files.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  Separated Stems ({job.result_files.length})
                                </h5>
                                <div className="grid gap-3">
                                  {job.result_files.map((file, index) => {
                                    // Handle both old and new data formats
                                    const stemName = file.stem || file.name || `stem_${index}`
                                    const fileUrl = file.url
                                    
                                    if (!fileUrl) {
                                      console.warn(`No URL found for stem: ${stemName}`, file)
                                      return (
                                        <div key={index} className="border rounded-lg p-3 bg-red-50 dark:bg-red-900/20">
                                          <div className="text-sm text-red-600 dark:text-red-400">
                                            {stemName}: URL not available
                                          </div>
                                        </div>
                                      )
                                    }
                                    
                                    return (
                                      <StemPlayer
                                        key={`${job.id}-${stemName}-${index}`}
                                        stem={stemName}
                                        url={fileUrl}
                                        filename={`${job.audio_files?.original_name?.replace(/\.[^/.]+$/, '')}_${stemName}.wav`}
                                      />
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Debug info for troubleshooting */}
                            {job.status === 'completed' && (!job.result_files || job.result_files.length === 0) && (
                              <div className="space-y-2">
                                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                                  ⚠️ Separation completed but no result files found
                                </div>
                                <details className="text-xs text-gray-500">
                                  <summary className="cursor-pointer">Debug Info</summary>
                                  <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
                                    {JSON.stringify({ 
                                      result_files: job.result_files,
                                      status: job.status,
                                      job_id: job.id 
                                    }, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}

                            {job.status === 'failed' && (
                              <div className="text-sm text-red-600 dark:text-red-400">
                                Separation failed. Please try again.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 