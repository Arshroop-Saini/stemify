"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Loader2, Play, Pause, Download, Music, Clock, Sparkles, Mic, Drum, Guitar, Piano, Volume2, Zap, Crown, Timer, CreditCard, X, Calendar, Trash2, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import { SUBSCRIPTION_TIERS, SIEVE_CONFIG } from '@/lib/constants'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { getUserStats } from '@/lib/user-stats'
import WaveSurfer from 'wavesurfer.js'
import { SeparationResults } from './separation-results'

// Audio file interface based on database structure
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

interface SeparationJob {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  selectedStems: string[]
  quality: 'standard' | 'pro'
  resultFiles?: Array<{
    stem: string
    url: string
    size: number
  }>
  errorMessage?: string
  createdAt: string
  completedAt?: string
  fileName?: string // Add filename for display
  userId?: string // Add user ID for filtering
  audio_file_id?: string // Add audio file ID for original track playback (match DB structure)
}

interface SeparationInterfaceProps {
  selectedFile: AudioFile | null
  className?: string
  onSeparationComplete?: () => void
}

const STEM_OPTIONS = [
  {
    id: 'vocals',
    name: 'Vocals',
    description: 'Lead and backing vocals',
    icon: Mic,
    selectedColor: 'text-blue-600 bg-blue-50 border-blue-300',
    tier: 'free'
  },
  {
    id: 'drums',
    name: 'Drums',
    description: 'Drum kit and percussion',
    icon: Drum,
    selectedColor: 'text-red-600 bg-red-50 border-red-300',
    tier: 'free'
  },
  {
    id: 'bass',
    name: 'Bass',
    description: 'Bass guitar and synth bass',
    icon: Volume2,
    selectedColor: 'text-purple-600 bg-purple-50 border-purple-300',
    tier: 'free'
  },
  {
    id: 'other',
    name: 'Other',
    description: 'All other instruments',
    icon: Music,
    selectedColor: 'text-slate-600 bg-slate-50 border-slate-300',
    tier: 'free'
  },
  {
    id: 'guitar',
    name: 'Guitar',
    description: 'Electric and acoustic guitar',
    icon: Guitar,
    selectedColor: 'text-orange-600 bg-orange-50 border-orange-300',
    tier: 'creator'
  },
  {
    id: 'piano',
    name: 'Piano',
    description: 'Piano and keyboard',
    icon: Piano,
    selectedColor: 'text-cyan-600 bg-cyan-50 border-cyan-300',
    tier: 'creator'
  }
]

// Compact original track player for recent separations cards
function CompactOriginalTrackPlayer({ fileName, audioFileId }: { fileName: string; audioFileId?: string }) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Fetch the original audio file URL
  useEffect(() => {
    const fetchAudioUrl = async () => {
      if (!audioFileId) {
        console.log('No audioFileId provided for:', fileName)
        setIsLoading(false)
        setError('No audio file ID')
        return
      }

      try {
        console.log('Fetching audio URL for audioFileId:', audioFileId)
        const supabase = createClient()
        
        // Get the audio file record
        const { data: audioFile, error: fileError } = await supabase
          .from('audio_files')
          .select('storage_path, filename')
          .eq('id', audioFileId)
          .single()

        console.log('Audio file data:', audioFile, 'Error:', fileError)

        if (fileError) {
          console.error('Database error:', fileError)
          throw new Error(`Database error: ${fileError.message}`)
        }

        if (!audioFile) {
          throw new Error('Audio file not found in database')
        }

        console.log('Audio file found:', audioFile)

        // Use the correct bucket name 'audio-files'
        const { data: urlData, error: urlError } = await supabase.storage
          .from('audio-files')
          .createSignedUrl(audioFile.storage_path, 3600)

        if (urlData?.signedUrl) {
          console.log('Success with audio-files bucket')
          setAudioUrl(urlData.signedUrl)
        } else {
          console.log('Failed with audio-files bucket:', urlError)
          
          // Try public URL as fallback
          const { data: publicUrlData } = supabase.storage
            .from('audio-files')
            .getPublicUrl(audioFile.storage_path)
          
          if (publicUrlData?.publicUrl) {
            console.log('Using public URL as fallback:', publicUrlData.publicUrl)
            setAudioUrl(publicUrlData.publicUrl)
          } else {
            throw new Error('Could not get signed URL or public URL')
          }
        }
      } catch (error) {
        console.error('Error fetching audio URL for', fileName, ':', error)
        setError('Failed to load original audio')
        setIsLoading(false)
      }
    }

    fetchAudioUrl()
  }, [audioFileId, fileName])

  // Initialize WaveSurfer when URL is available
  useEffect(() => {
    let isMounted = true

    if (!audioUrl || !waveformRef.current) {
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
        wavesurfer.current = null
      }
      if (isMounted) {
        setIsLoading(false)
        setError(null)
        setIsPlaying(false)
      }
      return
    }

    if (isMounted) {
      setIsLoading(true)
      setError(null)
      setIsPlaying(false)
    }

    if (wavesurfer.current) {
      wavesurfer.current.destroy()
      wavesurfer.current = null
    }
    if (waveformRef.current) {
      waveformRef.current.innerHTML = ''
    }

    const initWaveformAsync = async () => {
      if (!isMounted || !waveformRef.current || !audioUrl) {
        if (isMounted) setIsLoading(false)
        return
      }

      let localWaveSurferInstance: WaveSurfer | null = null

      try {
        const cleanUrl = audioUrl.endsWith('?') ? audioUrl.slice(0, -1) : audioUrl
        console.log(`Initializing waveform for ${fileName} with URL: ${cleanUrl}`)

        if (!isMounted || !waveformRef.current) {
          if (isMounted) setIsLoading(false)
          return
        }

        localWaveSurferInstance = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#22C55E40',
          progressColor: '#22C55E',
          height: 35,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
          cursorWidth: 2,
          cursorColor: '#22C55E',
          mediaControls: false,
          interact: true,
        })

        localWaveSurferInstance.on('ready', () => {
          if (isMounted) {
            setIsLoading(false)
            console.log(`WaveSurfer ready for ${fileName}`)
          }
        })
        localWaveSurferInstance.on('play', () => { if (isMounted) setIsPlaying(true) })
        localWaveSurferInstance.on('pause', () => { if (isMounted) setIsPlaying(false) })
        localWaveSurferInstance.on('finish', () => { if (isMounted) setIsPlaying(false) })
        localWaveSurferInstance.on('error', (err: any) => {
          if (isMounted) {
            console.error(`WaveSurfer error for ${fileName}:`, err)
            const message = typeof err === 'string' ? err : (err.message || 'Unknown WaveSurfer error')
            setError(`Waveform error: ${message}`)
            setIsLoading(false)
          }
        })

        if (isMounted) {
          wavesurfer.current = localWaveSurferInstance
        } else {
          localWaveSurferInstance.destroy()
          if (isMounted) setIsLoading(false)
          return
        }

        const loadPromise = wavesurfer.current.load(cleanUrl)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Waveform loading timed out after 10 seconds")), 10000)
        )

        await Promise.race([loadPromise, timeoutPromise])
        
      } catch (e: any) {
        if (isMounted) {
          console.error(`Critical error initializing waveform for ${fileName}:`, e)
          setError(`Failed to initialize: ${e.message || 'Unknown error'}`)
          setIsLoading(false)
        }
        if (localWaveSurferInstance && localWaveSurferInstance !== wavesurfer.current) {
          localWaveSurferInstance.destroy()
        }
      }
    }

    initWaveformAsync()

    return () => {
      isMounted = false
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
        wavesurfer.current = null
        console.log(`WaveSurfer instance for ${fileName} destroyed on cleanup.`)
      }
    }
  }, [audioUrl, fileName])

  const togglePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening modal when clicking play button
    
    if (wavesurfer.current && !isLoading && !error) {
      try {
        if (isPlaying) {
          wavesurfer.current.pause()
        } else {
          await wavesurfer.current.play()
        }
      } catch (e: any) {
        console.error(`Error toggling playback for ${fileName}:`, e)
        setError(`Playback error: ${e.message || 'Unknown error'}`)
      }
    } else {
      console.warn(`Toggle play attempted for ${fileName} but waveform not ready, still loading, or in error state.`)
      if (isLoading) toast.error("Waveform is still loading.")
      else if (error) toast.error("Cannot play, waveform has an error.")
      else if (!audioUrl) toast.error("No audio URL to play.")
    }
  }

  if (!audioFileId) {
    return (
      <div className="flex items-center gap-2 p-2 bg-surface-light dark:bg-surface-dark rounded border">
        <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <Music className="w-3 h-3 text-gray-400" />
        </div>
        <div className="flex-1 text-xs text-gray-400 text-center py-1">No audio file linked</div>
        <div className="text-xs text-muted-foreground shrink-0 max-w-[80px] truncate">
          {fileName}
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 bg-surface-light dark:bg-surface-dark rounded-lg border shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent"></div>
          <span className="font-medium text-xs truncate">{fileName}</span>
          {error && (
            <span className="text-xs text-red-500" title={error}>⚠️</span>
          )}
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className="h-6 w-6 p-0 text-accent hover:text-accent/80"
          >
            {isPlaying ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="h-10 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center justify-center px-2">
          <span className="text-xs text-red-600 dark:text-red-400 text-center truncate" title={error}>{error}</span>
        </div>
      ) : (
        <div className="space-y-1">
          <div 
            ref={waveformRef} 
            className="cursor-pointer min-h-[35px] rounded"
            onClick={(e) => e.stopPropagation()} // Allow waveform interaction without opening modal
          />
          {isLoading && (
            <div className="flex items-center justify-center py-2">
              <span className="text-xs text-gray-400">Loading waveform...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Compact stem player for processing results
function ProcessingResultPlayer({ stem, url, filename }: { stem: string; url: string; filename: string }) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Color mapping for different stems
  const stemColors = {
    vocals: '#3B82F6',     // Blue
    drums: '#EF4444',      // Red  
    bass: '#8B5CF6',       // Purple
    other: '#6B7280',      // Gray
    guitar: '#F59E0B',     // Orange
    piano: '#EC4899',      // Pink
  }

  const stemColor = stemColors[stem as keyof typeof stemColors] || '#6B7280'

  useEffect(() => {
    let isMounted = true

    if (!url || !waveformRef.current) {
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
        wavesurfer.current = null
      }
      if (isMounted) {
        setIsLoading(false)
        setError(null)
        setIsPlaying(false)
      }
      return
    }

    if (isMounted) {
      setIsLoading(true)
      setError(null)
      setIsPlaying(false)
    }

    if (wavesurfer.current) {
      wavesurfer.current.destroy()
      wavesurfer.current = null
    }
    if (waveformRef.current) {
      waveformRef.current.innerHTML = ''
    }

    const initWaveform = async () => {
      if (!isMounted || !waveformRef.current || !url) {
        if (isMounted) setIsLoading(false)
        return
      }

      try {
        const cleanUrl = url.endsWith('?') ? url.slice(0, -1) : url

        const instance = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: stemColor + '40',
          progressColor: stemColor,
          height: 30,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
          cursorWidth: 2,
          cursorColor: stemColor,
          mediaControls: false,
          interact: true,
        })

        instance.on('ready', () => {
          if (isMounted) setIsLoading(false)
        })
        instance.on('play', () => { if (isMounted) setIsPlaying(true) })
        instance.on('pause', () => { if (isMounted) setIsPlaying(false) })
        instance.on('finish', () => { if (isMounted) setIsPlaying(false) })
        instance.on('error', (err: any) => {
          if (isMounted) {
            console.error(`WaveSurfer error for ${stem}:`, err)
            setError('Failed to load audio')
            setIsLoading(false)
          }
        })

        if (isMounted) {
          wavesurfer.current = instance
          await instance.load(cleanUrl)
        } else {
          instance.destroy()
        }
      } catch (e: any) {
        if (isMounted) {
          setError('Failed to initialize')
          setIsLoading(false)
        }
      }
    }

    initWaveform()

    return () => {
      isMounted = false
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
        wavesurfer.current = null
      }
    }
  }, [url, stem, stemColor])

  const togglePlayPause = async () => {
    if (wavesurfer.current && !isLoading && !error) {
      try {
        if (isPlaying) {
          wavesurfer.current.pause()
        } else {
          await wavesurfer.current.play()
        }
      } catch (e: any) {
        console.error(`Error toggling playback for ${stem}:`, e)
        toast.error('Playback failed')
      }
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

  return (
    <div className="flex items-center gap-3 p-2 bg-surface-light dark:bg-surface-dark rounded-lg border">
      <div 
        className="w-2 h-2 rounded-full shrink-0" 
        style={{ backgroundColor: stemColor }}
      />
      <span className="text-sm font-medium capitalize min-w-0 flex-shrink">{stem}</span>
      <div className="flex-1 min-w-0">
        {error ? (
          <div className="text-xs text-red-500 text-center">Error loading</div>
        ) : (
          <div 
            ref={waveformRef} 
            className="cursor-pointer min-h-[30px]"
          />
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          disabled={isLoading || !!error}
          className="h-6 w-6 p-0"
          style={{ color: stemColor }}
        >
          {isPlaying ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          className="h-6 w-6 p-0"
          style={{ color: stemColor }}
        >
          <Download className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

// Recent separations manager (separate from current processing job)
function useRecentSeparations() {
  const { user } = useAuth()
  const [recentJobs, setRecentJobs] = useState<SeparationJob[]>([])

  // Load recent jobs on mount
  useEffect(() => {
    if (user) {
      const savedJobs = localStorage.getItem(`recentSeparations_${user.id}`)
      if (savedJobs) {
        try {
          const jobs = JSON.parse(savedJobs)
          // Filter out jobs older than 7 days
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
          const validJobs = jobs.filter((job: SeparationJob) => 
            new Date(job.createdAt).getTime() > weekAgo
          )
          setRecentJobs(validJobs)
        } catch (error) {
          console.error('Failed to parse recent jobs:', error)
          localStorage.removeItem(`recentSeparations_${user.id}`)
        }
      }
    }
  }, [user])

  const addRecentJob = useCallback((job: SeparationJob) => {
    if (!user) return
    
    setRecentJobs(prev => {
      // Add new job to the beginning, remove duplicates, keep max 5
      const filtered = prev.filter(j => j.jobId !== job.jobId)
      const updated = [job, ...filtered].slice(0, 5)
      
      // Persist to localStorage
      localStorage.setItem(`recentSeparations_${user.id}`, JSON.stringify(updated))
      return updated
    })
  }, [user])

  const updateRecentJob = useCallback((jobId: string, updates: Partial<SeparationJob>) => {
    if (!user) return
    
    setRecentJobs(prev => {
      const updated = prev.map(job => 
        job.jobId === jobId ? { ...job, ...updates } : job
      )
      localStorage.setItem(`recentSeparations_${user.id}`, JSON.stringify(updated))
      return updated
    })
  }, [user])

  const removeRecentJob = useCallback((jobId: string) => {
    if (!user) return
    
    setRecentJobs(prev => {
      const updated = prev.filter(job => job.jobId !== jobId)
      localStorage.setItem(`recentSeparations_${user.id}`, JSON.stringify(updated))
      return updated
    })
  }, [user])

  return { recentJobs, addRecentJob, updateRecentJob, removeRecentJob }
}

export function SeparationInterface({ selectedFile, className, onSeparationComplete }: SeparationInterfaceProps) {
  const { user } = useAuth()
  const [selectedStems, setSelectedStems] = useState<string[]>(['vocals', 'drums', 'bass', 'other'])
  const [quality, setQuality] = useState<'standard' | 'pro'>('standard')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentJob, setCurrentJob] = useState<SeparationJob | null>(null)
  const [userTier, setUserTier] = useState<'free' | 'creator' | 'studio'>('free')
  
  // Modal state for recent separations
  const [selectedJobForModal, setSelectedJobForModal] = useState<SeparationJob | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Modal state for full separation history
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  
  const { recentJobs, addRecentJob, updateRecentJob, removeRecentJob } = useRecentSeparations()

  // Mock user tier - in real app, get from user profile
  useEffect(() => {
    // Fetch actual user subscription tier
    const fetchUserTier = async () => {
      if (user?.id) {
        try {
          const stats = await getUserStats(user.id)
          setUserTier(stats.subscriptionTier)
        } catch (error) {
          console.error('Failed to fetch user tier:', error)
          setUserTier('free') // Fallback to free
        }
      }
    }
    
    fetchUserTier()
  }, [user?.id])

  // Calculate processing estimate
  const calculateEstimate = useCallback(() => {
    if (!selectedFile || !selectedFile.duration) return { trackLength: 0, cost: 0 }
    
    // Convert seconds to minutes with precision
    const durationMinutes = selectedFile.duration / 60
    
    // Credit calculation: 1x duration for normal, 2x duration for pro (regardless of stem count)
    const creditMultiplier = quality === 'pro' ? 2 : 1
    const totalCost = durationMinutes * creditMultiplier
    
    return {
      trackLength: durationMinutes, // Actual track length in minutes
      cost: Number(totalCost.toFixed(1)) // Credits required based on model
    }
  }, [selectedFile, quality])

  // Handle stem selection
  const handleStemToggle = useCallback((stemId: string) => {
    setSelectedStems(prev => {
      if (prev.includes(stemId)) {
        return prev.filter(id => id !== stemId)
      } else {
        return [...prev, stemId]
      }
    })
  }, [])

  // Check if user can access premium features
  const canUsePremiumFeature = useCallback((requiredTier: string) => {
    const tierLevels = { free: 0, creator: 1, studio: 2 }
    return tierLevels[userTier] >= tierLevels[requiredTier as keyof typeof tierLevels]
  }, [userTier])

  // Start separation job
  const handleStartSeparation = useCallback(async () => {
    if (!selectedFile || !user || selectedStems.length === 0) return

    console.log('Starting separation with file:', selectedFile)
    console.log('Selected file ID:', selectedFile.id)
    console.log('User ID:', user.id)

    try {
      setIsProcessing(true)
      setCurrentJob(null) // Reset any existing job state
      
      // Get current session token
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No valid session found. Please sign in again.')
      }

      const requestBody = {
        audioFileId: selectedFile.id,
        selectedStems,
        quality,
        model: quality === 'pro' ? 'htdemucs_ft' : 'htdemucs'
      }

      console.log('Request body:', requestBody)
      
      const response = await fetch('/api/separate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      console.log('API response:', { status: response.status, result })

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start separation')
      }

      // Check if the separation completed immediately (synchronous response)
      if (result.status === 'completed' && result.resultFiles) {
        console.log('Separation completed synchronously!')
        
        const completedJob = {
          jobId: result.jobId,
          status: 'completed' as const,
          progress: 100,
          selectedStems,
          quality,
          resultFiles: result.resultFiles,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          fileName: selectedFile.original_name,
          userId: user.id,
          audio_file_id: selectedFile.id
        }
        
        setCurrentJob(completedJob)
        addRecentJob(completedJob) // Add to recent jobs
        
        setIsProcessing(false) // Reset processing state immediately
        toast.success('Separation completed! 🎉')
        onSeparationComplete?.()
        
        return // Don't start polling since it's already done
      }
      
      // Handle asynchronous processing case
      toast.success('Separation job started! ⚡')
      
      // Start polling for job status
      const pendingJob = {
        jobId: result.jobId,
        status: 'pending' as const,
        progress: 0,
        selectedStems,
        quality,
        createdAt: new Date().toISOString(),
        fileName: selectedFile.original_name,
        userId: user.id,
        audio_file_id: selectedFile.id
      }
      
      setCurrentJob(pendingJob)
      addRecentJob(pendingJob) // Add to recent jobs immediately

      // Start status polling
      pollJobStatus(result.jobId)

    } catch (error) {
      console.error('Failed to start separation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start separation')
      
      // Reset state on error
      setCurrentJob(null)
    } finally {
      setIsProcessing(false)
    }
  }, [selectedFile, user, selectedStems, quality])

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      // Get current session token
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        console.error('No valid session for polling')
        return
      }
      
      const response = await fetch(`/api/separate?jobId=${jobId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const job = await response.json()

      if (response.ok) {
        const updatedJob = (prev: SeparationJob | null) => prev ? { 
          ...prev, 
          ...job,
          // Map API response to expected format
          resultFiles: job.resultFiles || job.result_files
        } : null
        
        setCurrentJob(updatedJob)
        
        // Update recent jobs as well
        if (currentJob) {
          updateRecentJob(jobId, {
            ...job,
            resultFiles: job.resultFiles || job.result_files
          })
        }

        // Continue polling if still processing
        if (job.status === 'pending' || job.status === 'processing') {
          setTimeout(() => pollJobStatus(jobId), 2000) // Poll every 2 seconds
        } else if (job.status === 'completed') {
          console.log('Polling detected completion:', job)
          toast.success('Separation completed! 🎉')
          onSeparationComplete?.()
          // Note: Don't reset currentJob here - keep it to show results
        } else if (job.status === 'failed') {
          toast.error('Separation failed. Please try again.')
          // Reset currentJob on failure after a delay
          setTimeout(() => setCurrentJob(null), 3000)
        }
      }
    } catch (error) {
      console.error('Failed to get job status:', error)
    }
  }, [onSeparationComplete])

  // Function to start a new separation (reset state)
  const handleNewSeparation = useCallback(() => {
    setCurrentJob(null)
    setIsProcessing(false)
  }, [])

  // Modal functions for recent separations
  const openJobModal = (job: SeparationJob) => {
    setSelectedJobForModal(job)
    setIsModalOpen(true)
  }

  const closeJobModal = () => {
    setSelectedJobForModal(null)
    setIsModalOpen(false)
  }

  // Handle deletion of recent separations
  const handleDeleteRecentJob = async (jobId: string) => {
    try {
      console.log('=== STARTING RECENT SEPARATION DELETION ===')
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

      // Call server-side deletion API (using jobId as the identifier)
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

      // Remove from local storage immediately
      removeRecentJob(jobId)
      toast.success(result.message || 'Separation deleted successfully')
      
    } catch (error) {
      console.error('=== RECENT SEPARATION DELETION ERROR ===')
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

  const estimate = calculateEstimate()
  const tierConfig = SUBSCRIPTION_TIERS[userTier]

  return (
    <div className={cn("space-y-6", className)}>
      {/* Separation Configuration */}
      {!selectedFile ? (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Select an audio file
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Choose a file from your library to start separation
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Separation Options
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{selectedFile.original_name}</span>
              <Badge variant="secondary">
                {userTier} plan
              </Badge>
            </div>
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Stem Selection */}
          <div>
            <Label className="text-base font-medium mb-4 block">
              Select Stems to Extract ({selectedStems.length}/6)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {STEM_OPTIONS.map((stem) => {
                const isDisabled = !canUsePremiumFeature(stem.tier)
                const isSelected = selectedStems.includes(stem.id)
                
                return (
                  <div
                    key={stem.id}
                    className={cn(
                      "relative p-4 rounded-lg border-2 transition-all cursor-pointer",
                      isSelected 
                        ? `${stem.selectedColor} border-current shadow-sm` 
                        : "border bg-surface-light dark:bg-surface-dark hover:border-gray-300 dark:hover:border-gray-600",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !isDisabled && handleStemToggle(stem.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={() => !isDisabled && handleStemToggle(stem.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <stem.icon className="w-5 h-5" />
                          <span className="font-medium">{stem.name}</span>
                          {stem.tier !== 'free' && (
                            <Badge variant="outline" className="text-xs">
                              Pro
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {stem.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quality Selection */}
          <div>
            <Label className="text-base font-medium mb-4 block flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Processing Quality
            </Label>
            <RadioGroup
              value={quality}
              onValueChange={(value: string) => setQuality(value as 'standard' | 'pro')}
              className="space-y-3"
            >
              <div className={cn(
                "relative flex items-center space-x-4 p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                quality === 'standard' 
                  ? "border-accent bg-accent/5 shadow-sm" 
                  : "border-gray-200 hover:border-accent/50 hover:bg-accent/5"
              )}>
                <RadioGroupItem value="standard" id="standard" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="standard" className="cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold text-base">Standard Quality</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Fast processing • Good quality separation • Recommended for most users
                        </div>
                      </div>

                    </div>
                  </Label>
                </div>
              </div>
              
              <div className={cn(
                "relative flex items-center space-x-4 p-5 rounded-xl border-2 transition-all duration-200",
                quality === 'pro' 
                  ? "border-accent bg-accent/5 shadow-sm" 
                  : "border-gray-200 hover:border-accent/50 hover:bg-accent/5",
                !canUsePremiumFeature('creator') && "opacity-60 cursor-not-allowed"
              )}>
                <RadioGroupItem
                  value="pro"
                  id="pro"
                  disabled={!canUsePremiumFeature('creator')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="pro" className={cn(
                    "cursor-pointer",
                    !canUsePremiumFeature('creator') && "cursor-not-allowed"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-amber-500" />
                          <span className="font-semibold text-base">Pro Quality</span>
                          {!canUsePremiumFeature('creator') && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              Creator Plan Required
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Highest quality • Fine-tuned model • 4x processing time
                        </div>
                      </div>

                    </div>
                  </Label>
                </div>
                {!canUsePremiumFeature('creator') && (
                  <div className="absolute inset-0 bg-gray-100/20 dark:bg-gray-800/20 rounded-xl pointer-events-none" />
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Processing Estimate */}
          <div className="bg-gradient-to-br from-accent/5 via-accent/10 to-transparent border border-accent/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Clock className="w-4 h-4 text-accent" />
              </div>
              <h4 className="font-semibold text-base">Processing Estimate</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 bg-surface-light dark:bg-surface-dark shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Track Length</span>
                </div>
                <div className="font-mono text-xl font-bold">
                  {estimate.trackLength.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-surface-light dark:bg-surface-dark shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Credits Required</span>
                </div>
                <div className="font-mono text-xl font-bold">
                  {estimate.cost}
                  <span className="text-sm font-normal text-muted-foreground ml-1">credits</span>
                </div>
              </div>
            </div>
            {quality === 'pro' && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/30">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Pro quality uses 2x credits for enhanced processing
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStartSeparation}
            disabled={
              selectedStems.length === 0 || 
              isProcessing || 
              (currentJob?.status === 'pending' || currentJob?.status === 'processing')
            }
            className="w-full"
            size="lg"
          >
            {isProcessing || (currentJob?.status === 'processing') ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : currentJob?.status === 'completed' ? (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Start New Separation ({selectedStems.length} stems)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Start Separation ({selectedStems.length} stems)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Recent Separations - Enhanced Design */}
      {recentJobs.length > 0 && (
        <Card className="bg-gradient-to-br from-accent/5 via-accent/10 to-transparent border-accent/20">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Recent Separations</h3>
                <p className="text-sm text-muted-foreground">Your last {recentJobs.length} audio separations</p>
              </div>
              <Badge variant="secondary" className="bg-accent/20 text-accent-foreground border-accent/30">
                {recentJobs.length}/5
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentJobs.map((job, index) => (
              <Card 
                key={job.jobId} 
                className="bg-surface-light dark:bg-surface-dark border shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-accent/50"
                onClick={() => openJobModal(job)}
              >
                <CardContent className="p-3 space-y-3">
                  {/* Job Info Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{job.fileName || 'Unknown File'}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{job.selectedStems.length} stems</span>
                        <span className="capitalize">{job.quality}</span>
                        <span>
                          {new Date(job.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </span>
                        {job.status === 'processing' && (
                          <span className="text-accent">⚡ {job.progress}%</span>
                        )}
                        {job.status === 'failed' && (
                          <span className="text-red-500">✗ Failed</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteRecentJob(job.jobId)
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  {/* Original Track Waveform */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <CompactOriginalTrackPlayer 
                      fileName={job.fileName || 'Unknown File'}
                      audioFileId={job.audio_file_id}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
          <div className="px-6 pb-4">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setIsHistoryModalOpen(true)}
            >
              <Clock className="w-4 h-4 mr-2" />
              Full Separation History
            </Button>
          </div>
        </Card>
      )}

      {/* Job Details Modal */}
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
                  {selectedJobForModal.fileName || 'Audio Separation'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedJobForModal.selectedStems.length} stems • {selectedJobForModal.quality} quality
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeJobModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Job Info */}
              <div className="mb-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(selectedJobForModal.createdAt).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge variant={
                    selectedJobForModal.status === 'completed' ? 'default' :
                    selectedJobForModal.status === 'failed' ? 'destructive' :
                    selectedJobForModal.status === 'processing' ? 'secondary' :
                    'outline'
                  }>
                    {selectedJobForModal.status === 'processing' ? '⚡ Processing' : 
                     selectedJobForModal.status === 'completed' ? '✓ Completed' :
                     selectedJobForModal.status === 'failed' ? '✗ Failed' : '⏳ Pending'}
                  </Badge>
                  
                  {/* Progress for processing jobs */}
                  {selectedJobForModal.status === 'processing' && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm">{selectedJobForModal.progress}% complete</span>
                      <div className="w-32">
                        <Progress value={selectedJobForModal.progress} className="h-2" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stems Results */}
              {selectedJobForModal.status === 'completed' && selectedJobForModal.resultFiles && selectedJobForModal.resultFiles.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-heading font-semibold mb-4">Separated Stems</h3>
                  <div className="grid gap-4">
                    {selectedJobForModal.resultFiles.map((file) => (
                      <div key={`modal-${selectedJobForModal.jobId}-${file.stem}`} className="border rounded-lg p-4 bg-surface-light dark:bg-surface-dark">
                        <ProcessingResultPlayer
                          stem={file.stem}
                          url={file.url}
                          filename={`${selectedJobForModal.fileName?.replace(/\.[^/.]+$/, '') || 'audio'}_${file.stem}.wav`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedJobForModal.status === 'failed' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Separation Failed</h3>
                  <p className="text-muted-foreground">
                    The audio separation process failed. Please try again with a different file or quality setting.
                  </p>
                </div>
              ) : selectedJobForModal.status === 'processing' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Processing Audio</h3>
                  <p className="text-muted-foreground">
                    Your audio is being separated into individual stems. This may take a few minutes.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Waiting to Process</h3>
                  <p className="text-muted-foreground">
                    Your separation job is in the queue and will begin processing shortly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Separation History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsHistoryModalOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-background border rounded-lg shadow-xl w-full mx-4 max-h-[95vh] overflow-hidden" style={{ maxWidth: '90vw' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-heading font-bold">
                  Full Separation History
                </h2>
                <p className="text-sm text-muted-foreground">
                  Complete history of all your audio separations
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsHistoryModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Body - Full Separation Results Component */}
            <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
              <SeparationResults />
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 