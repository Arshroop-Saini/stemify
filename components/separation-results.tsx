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
import { Download, Play, Pause, Calendar, Clock, Music, ChevronDown, ChevronRight, Trash2, MoreVertical, Volume2, RefreshCw, X } from 'lucide-react'
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
    <div className="border rounded-lg p-3 bg-surface-light dark:bg-surface-dark shadow-sm">
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

// Main track player component for original audio
function MainTrackPlayer({ audioFileId, filename, duration }: { audioFileId: string; filename: string; duration?: number }) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration || 0)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    // Fetch audio URL from Supabase storage
    const fetchAudioUrl = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('audio_files')
          .select('storage_path')
          .eq('id', audioFileId)
          .single()

        if (error || !data) {
          setError('Audio file not found')
          return
        }

        // Get signed URL for the audio file
        const { data: urlData } = await supabase.storage
          .from('audio-files')
          .createSignedUrl(data.storage_path, 3600) // 1 hour expiry

        if (urlData?.signedUrl) {
          setAudioUrl(urlData.signedUrl)
        } else {
          setError('Could not load audio')
        }
      } catch (err) {
        console.error('Error fetching audio URL:', err)
        setError('Failed to load audio')
      }
    }

    fetchAudioUrl()
  }, [audioFileId])

  useEffect(() => {
    if (audioUrl && waveformRef.current && !wavesurfer.current) {
      initializeWaveform()
    }
    
    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
        wavesurfer.current = null
      }
    }
  }, [audioUrl])

  const initializeWaveform = async () => {
    if (!waveformRef.current || wavesurfer.current || !audioUrl) return

    setIsLoading(true)
    setError(null)
    
    try {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#22C55E40',
        progressColor: '#22C55E',
        height: 60,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        cursorWidth: 2,
        cursorColor: '#22C55E',
        mediaControls: false,
        interact: true
      })

      wavesurfer.current.on('ready', () => {
        setAudioDuration(wavesurfer.current?.getDuration() || 0)
        setIsLoading(false)
      })

      wavesurfer.current.on('audioprocess', () => {
        setCurrentTime(wavesurfer.current?.getCurrentTime() || 0)
      })

      wavesurfer.current.on('play', () => setIsPlaying(true))
      wavesurfer.current.on('pause', () => setIsPlaying(false))
      wavesurfer.current.on('finish', () => setIsPlaying(false))
      wavesurfer.current.on('error', (err) => {
        console.error('WaveSurfer error:', err)
        setError('Waveform error')
        setIsLoading(false)
      })

      await wavesurfer.current.load(audioUrl)
      
    } catch (error) {
      console.error('Error initializing main track waveform:', error)
      setError('Failed to initialize audio')
      setIsLoading(false)
    }
  }

  const togglePlayPause = async () => {
    if (!wavesurfer.current) return

    try {
      if (isPlaying) {
        wavesurfer.current.pause()
      } else {
        await wavesurfer.current.play()
      }
    } catch (error) {
      console.error('Error toggling playback:', error)
      setError('Playback error')
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="border rounded-lg p-4 bg-accent/5 border-accent/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-accent" />
          <span className="font-medium text-accent">Original Track</span>
          <span className="text-sm text-gray-500">{filename}</span>
          {error && <span className="text-xs text-red-500">⚠️</span>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          disabled={isLoading || !!error || !audioUrl}
          className="h-10 w-10 p-0 text-accent hover:bg-accent/10"
        >
          {isLoading ? (
            <div className="w-5 h-5 animate-spin border-2 border-gray-300 border-t-accent rounded-full" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </Button>
      </div>

      {error ? (
        <div className="h-15 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center justify-center">
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div 
            ref={waveformRef} 
            className="cursor-pointer min-h-[60px] rounded bg-accent/5"
          />
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>{formatTime(currentTime)}</span>
            {isLoading && <span className="text-gray-400">Loading audio...</span>}
            <span>{formatTime(audioDuration)}</span>
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
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [selectedJobForModal, setSelectedJobForModal] = useState<SeparationJob | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

      // Process jobs to fix status and ensure result_files are properly set
      const processedJobs = (data || []).map(job => {
        // If job has result_files but status is still pending, mark as completed
        if (job.result_files && job.result_files.length > 0 && job.status === 'pending') {
          console.log(`Job ${job.id} has result files but status is pending, marking as completed`)
          return {
            ...job,
            status: 'completed' as const
          }
        }
        return job
      })

      setJobs(processedJobs)
      
      // Update database for any jobs that were fixed
      const jobsToUpdate = processedJobs.filter(job => 
        job.result_files && job.result_files.length > 0 && 
        data?.find(originalJob => originalJob.id === job.id)?.status === 'pending'
      )
      
      if (jobsToUpdate.length > 0) {
        console.log(`Updating ${jobsToUpdate.length} jobs to completed status`)
        for (const job of jobsToUpdate) {
          await supabase
            .from('separation_jobs')
            .update({ 
              status: 'completed',
              progress: 100,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id)
        }
      }
      
    } catch (error) {
      console.error('Error fetching separation history:', error)
      toast.error('Failed to load separation history')
    } finally {
      setLoading(false)
    }
  }

  const refreshJobStatuses = async () => {
    if (!user) return

    try {
      const supabase = createClient()
      
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Authentication required')
        return
      }
      
      // Find all pending jobs and check if they should be completed
      const pendingJobs = jobs.filter(job => job.status === 'pending')
      
      if (pendingJobs.length === 0) {
        toast.info('No pending jobs to refresh')
        return
      }

      console.log(`Checking ${pendingJobs.length} pending jobs for completion...`)
      
      // Check each pending job for completion
      for (const job of pendingJobs) {
        try {
          // Call our separation API to check status with proper auth
          const response = await fetch(`/api/separate?jobId=${job.id}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          
          if (response.ok) {
            const jobStatus = await response.json()
            console.log(`Job ${job.id} status check:`, jobStatus)
            
            // If job is actually completed, update it in the database
            if (jobStatus.status === 'completed' && jobStatus.resultFiles) {
              await supabase
                .from('separation_jobs')
                .update({
                  status: 'completed',
                  progress: 100,
                  result_files: jobStatus.resultFiles,
                  completed_at: new Date().toISOString()
                })
                .eq('id', job.id)
                
              console.log(`Updated job ${job.id} to completed status`)
            }
          }
        } catch (error) {
          console.error(`Error checking job ${job.id}:`, error)
        }
      }
      
      // Refresh the data
      await fetchSeparationHistory()
      toast.success('Job statuses refreshed!')
      
    } catch (error) {
      console.error('Error refreshing job statuses:', error)
      toast.error('Failed to refresh job statuses')
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    try {
      console.log('=== STARTING CLIENT-SIDE DELETION REQUEST ===')
      console.log('Job ID:', jobId)

      // Get current session for authentication
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.error('Authentication error:', sessionError)
        toast.error('Authentication required. Please sign in again.')
        return
      }

      console.log('Session verified, calling deletion API...')

      // Call server-side deletion API
      const response = await fetch(`/api/separations/${jobId}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('API error response:', errorData)
        toast.error(errorData.error || `Delete failed with status ${response.status}`)
        return
      }

      const result = await response.json()
      console.log('API success response:', result)

      // Update UI state immediately
      setJobs(prev => prev.filter(job => job.id !== jobId))
      toast.success(result.message || 'Separation deleted successfully')
      
      // Refresh the data to ensure consistency
      setTimeout(() => {
        fetchSeparationHistory()
      }, 500)
      
    } catch (error) {
      console.error('=== CLIENT-SIDE DELETION ERROR ===')
      console.error('Error details:', error)
      
      let errorMessage = 'Failed to delete separation'
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast.error(errorMessage)
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

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(jobId)) {
        newSet.delete(jobId)
      } else {
        newSet.add(jobId)
      }
      return newSet
    })
  }

  const openJobModal = async (job: SeparationJob) => {
    console.log('Opening modal for job:', job.id, 'Current result_files:', job.result_files)
    setSelectedJobForModal(job)
    setIsModalOpen(true)
    
    // Always try to fetch the latest job data from API
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        console.log(`Fetching latest data for job ${job.id}...`)
        const response = await fetch(`/api/separate?jobId=${job.id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (response.ok) {
          const jobStatus = await response.json()
          console.log('API response for job:', jobStatus)
          
          // Update the selected job with latest data
          if (jobStatus.resultFiles && jobStatus.resultFiles.length > 0) {
            console.log('Found result files, updating modal:', jobStatus.resultFiles)
            const updatedJob = {
              ...job,
              result_files: jobStatus.resultFiles,
              status: jobStatus.status || 'completed'
            }
            setSelectedJobForModal(updatedJob)
            
            // Also update the job in the main list
            setJobs(prev => prev.map(j => 
              j.id === job.id ? { ...j, result_files: jobStatus.resultFiles, status: jobStatus.status || 'completed' } : j
            ))
          } else {
            console.log('No result files found in API response')
            // Check if job has stems data directly in database
            const { data: dbJob, error } = await supabase
              .from('separation_jobs')
              .select('result_files, status')
              .eq('id', job.id)
              .single()
            
            console.log('Database job data:', dbJob, error)
            
            if (dbJob?.result_files && dbJob.result_files.length > 0) {
              console.log('Found result files in database:', dbJob.result_files)
              const updatedJob = {
                ...job,
                result_files: dbJob.result_files,
                status: 'completed' as const
              }
              setSelectedJobForModal(updatedJob)
            }
          }
        } else {
          console.error('API call failed:', response.status, response.statusText)
        }
      } else {
        console.error('No session token available')
      }
    } catch (error) {
      console.error('Error fetching job status for modal:', error)
    }
  }

  const closeJobModal = () => {
    setSelectedJobForModal(null)
    setIsModalOpen(false)
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
                <div className="h-4 bg-surface-light dark:bg-surface-dark rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-surface-light dark:bg-surface-dark rounded w-1/2"></div>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshJobStatuses}
            className="ml-2 h-7 w-7 p-0"
            title="Refresh job statuses"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
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
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-surface-light dark:bg-surface-dark rounded-lg hover:bg-surface-light/70 dark:hover:bg-surface-dark/70 transition-colors">
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
                      {group.jobs.map((job) => {
                        const isJobExpanded = expandedJobs.has(job.id)
                        
                        return (
                          <Card 
                            key={job.id} 
                            className="bg-surface-light dark:bg-surface-dark cursor-pointer hover:bg-surface-light/70 dark:hover:bg-surface-dark/70 transition-colors"
                            onClick={() => openJobModal(job)}
                          >
                            <CardContent className="p-4 space-y-4">
                              {/* Job Header */}
                              <div className="flex items-start justify-between">
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
                                    <span>{job.credits_used.toFixed(2)} credits</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
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

                              {/* Main Track Player */}
                              {job.audio_file_id && (
                                <MainTrackPlayer
                                  audioFileId={job.audio_file_id}
                                  filename={job.audio_files?.original_name || 'Unknown file'}
                                  duration={job.audio_files?.duration}
                                />
                              )}

                              {/* Stems Dropdown */}
                              {job.result_files && job.result_files.length > 0 && (
                                <div className="space-y-3">
                                  <Button
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleJobExpansion(job.id)
                                    }}
                                    className="w-full justify-between"
                                  >
                                    <span className="flex items-center gap-2">
                                      <Volume2 className="w-4 h-4" />
                                      Separated Stems ({job.result_files.length})
                                    </span>
                                    {isJobExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </Button>
                                  
                                  {isJobExpanded && (
                                    <div className="grid gap-3 pt-2">
                                      {job.result_files.map((file, index) => {
                                        const stemName = file.stem || file.name || `stem_${index}`
                                        const fileUrl = file.url
                                        
                                        if (!fileUrl) {
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
                                  )}
                                </div>
                              )}

                              {/* Debug Info for Failed Jobs */}
                              {job.status === 'completed' && (!job.result_files || job.result_files.length === 0) && (
                                <div className="space-y-2">
                                  <div className="text-sm text-yellow-600 dark:text-yellow-400">
                                    ⚠️ Separation completed but no result files found
                                  </div>
                                  <details className="text-xs text-gray-500">
                                    <summary className="cursor-pointer">Debug Info</summary>
                                    <pre className="mt-2 p-2 bg-surface-light dark:bg-surface-dark rounded overflow-auto">
                                      {JSON.stringify({ 
                                        result_files: job.result_files,
                                        status: job.status,
                                        job_id: job.id 
                                      }, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              )}

                              {/* Failed Status */}
                              {job.status === 'failed' && (
                                <div className="text-sm text-red-600 dark:text-red-400">
                                  Separation failed. Please try again.
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Stems Modal */}
      {isModalOpen && selectedJobForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeJobModal}
          />
          
          {/* Modal Content */}
          <div className="relative bg-background border rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-heading font-bold">
                  {selectedJobForModal.audio_files?.original_name || 'Audio Separation'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedJobForModal.selected_stems.length} stems • {selectedJobForModal.quality} quality
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeJobModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Main Track */}
              <div className="mb-6">
                <MainTrackPlayer
                  audioFileId={selectedJobForModal.audio_file_id}
                  filename={selectedJobForModal.audio_files?.original_name || 'Unknown file'}
                  duration={selectedJobForModal.audio_files?.duration}
                />
              </div>
              
              {/* Stems */}
              {selectedJobForModal.result_files && selectedJobForModal.result_files.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-heading font-semibold mb-4">Separated Stems</h3>
                  <div className="grid gap-4">
                    {selectedJobForModal.result_files.map((file, index) => {
                      const stemName = file.stem || file.name || `stem_${index}`
                      const fileUrl = file.url
                      
                      if (!fileUrl) {
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
                          key={`${selectedJobForModal.id}-${stemName}-${index}`}
                          stem={stemName}
                          url={fileUrl}
                          filename={`${selectedJobForModal.audio_files?.original_name?.replace(/\.[^/.]+$/, '')}_${stemName}.wav`}
                        />
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No stems available for this separation</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
} 