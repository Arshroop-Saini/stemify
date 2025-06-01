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
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

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

  // Fetch fresh signed URL if this is a Supabase storage URL
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!url) return

      // Check if this is a Supabase storage URL that needs refreshing
      if (url.includes('supabase') && url.includes('storage')) {
        try {
          const supabase = createClient()
          // Extract the storage path from the URL
          const urlParts = url.split('/storage/v1/object/sign/')
          if (urlParts.length > 1) {
            const pathPart = urlParts[1].split('?')[0] // Remove query params
            const decodedPath = decodeURIComponent(pathPart)
            
            // Get fresh signed URL
            const { data: urlData } = await supabase.storage
              .from('separated-stems')
              .createSignedUrl(decodedPath, 3600) // 1 hour expiry

            if (urlData?.signedUrl) {
              setSignedUrl(urlData.signedUrl)
              return
            }
          }
        } catch (error) {
          console.error('Error refreshing signed URL:', error)
        }
      }
      
      // Use original URL if not Supabase storage or refresh failed
      setSignedUrl(url)
    }

    fetchSignedUrl()
  }, [url])

  useEffect(() => {
    let isMounted = true; // Flag to check if component is still mounted in async operations

    if (!signedUrl || !waveformRef.current) {
      // No URL or container, clean up and reset states
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
      }
      if (isMounted) {
        setIsLoading(false);
        setError(null);
        setDuration(0);
        setCurrentTime(0);
        setIsPlaying(false);
      }
      return;
    }

    // Start of new waveform setup, reset states
    if (isMounted) {
      setIsLoading(true); // Set loading true at the start of an attempt
      setError(null);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }

    // **Crucially, destroy any existing instance AND clear the container HTML**
    if (wavesurfer.current) {
      wavesurfer.current.destroy();
      wavesurfer.current = null;
    }
    if (waveformRef.current) { // Ensure ref is still valid before manipulating
        waveformRef.current.innerHTML = ''; // Clear the container to prevent visual duplicates
    }

    const initWaveformAsync = async () => {
      if (!isMounted || !waveformRef.current || !signedUrl) {
        if (isMounted) setIsLoading(false); // Ensure loading stops if no URL or unmounted
        return;
      }
      
      // Ensure isLoading is true if we are proceeding with initialization
      if (isMounted && !isLoading) setIsLoading(true);


      let localWaveSurferInstance: WaveSurfer | null = null; 

      try {
        const cleanUrl = signedUrl.endsWith('?') ? signedUrl.slice(0, -1) : signedUrl;
        console.log(`Initializing waveform for ${stem} with URL: ${cleanUrl}`);

        if (!isMounted || !waveformRef.current) { 
          if (isMounted) setIsLoading(false);
          return;
        }

        localWaveSurferInstance = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: stemColor + '40', progressColor: stemColor, height: 40,
          barWidth: 2, barGap: 1, barRadius: 2, normalize: true,
          cursorWidth: 2, cursorColor: stemColor, mediaControls: false, interact: true,
        });

        localWaveSurferInstance.on('ready', () => {
          if (isMounted) {
            setDuration(localWaveSurferInstance?.getDuration() || 0);
            setIsLoading(false);
            console.log(`WaveSurfer ready for ${stem}`);
          }
        });
        localWaveSurferInstance.on('audioprocess', () => {
          if (isMounted) {
            setCurrentTime(localWaveSurferInstance?.getCurrentTime() || 0);
          }
        });
        localWaveSurferInstance.on('play', () => { if (isMounted) setIsPlaying(true); });
        localWaveSurferInstance.on('pause', () => { if (isMounted) setIsPlaying(false); });
        localWaveSurferInstance.on('finish', () => { if (isMounted) setIsPlaying(false); });
        localWaveSurferInstance.on('error', (err: any) => {
          if (isMounted) {
            console.error(`WaveSurfer error for ${stem}:`, err);
            const message = typeof err === 'string' ? err : (err.message || 'Unknown WaveSurfer error');
            setError(`Waveform error: ${message}`);
            setIsLoading(false);
          }
        });

        if (isMounted) {
          wavesurfer.current = localWaveSurferInstance;
        } else {
          localWaveSurferInstance.destroy(); 
          if(isMounted) setIsLoading(false); 
          return;
        }

        const loadPromise = wavesurfer.current.load(cleanUrl);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Waveform loading timed out after 20 seconds")), 20000)
        );

        await Promise.race([loadPromise, timeoutPromise]);
        
      } catch (e: any) {
        if (isMounted) {
          console.error(`Critical error initializing waveform for ${stem}:`, e);
          setError(`Failed to initialize: ${e.message || 'Unknown error'}`);
          setIsLoading(false); 
        }
        if (localWaveSurferInstance && localWaveSurferInstance !== wavesurfer.current) {
            localWaveSurferInstance.destroy();
        }
      }
    };

    initWaveformAsync();

    return () => {
      isMounted = false;
      // This cleanup runs when component unmounts or deps change.
      // It should destroy the instance that wavesurfer.current points to.
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
        console.log(`WaveSurfer instance for ${stem} destroyed on cleanup.`);
      }
    };
  }, [signedUrl, stem, stemColor]); // Dependencies: signedUrl change triggers re-init. stem & stemColor for correctness.

  const togglePlayPause = async () => {
    if (wavesurfer.current && !isLoading && !error) {
      try {
        if (isPlaying) {
          wavesurfer.current.pause();
        } else {
          await wavesurfer.current.play();
        }
      } catch (e: any) {
        console.error(`Error toggling playback for ${stem}:`, e);
        setError(`Playback error: ${e.message || 'Unknown error'}`);
      }
    } else {
      console.warn(`Toggle play attempted for ${stem} but waveform not ready, still loading, or in error state.`);
      if (isLoading) toast.error("Waveform is still loading.");
      else if (error) toast.error("Cannot play, waveform has an error.");
      else if (!signedUrl) toast.error("No audio URL to play.");
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(signedUrl || url)
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
            <span className="text-xs text-red-500" title={error}>⚠️ Error</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlayPause}
            disabled={isLoading || !!error || !signedUrl}
            className="h-8 w-8 p-0"
            style={{ color: stemColor }}
          >
            {isPlaying ? (
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
        <div className="h-10 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center justify-center px-2">
          <span className="text-xs text-red-600 dark:text-red-400 text-center truncate" title={error}>{error}</span>
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

// MainTrackPlayer component for playing original audio in modal
function MainTrackPlayer({ jobId, audioFileId, trackName }: { jobId: string; audioFileId: string; trackName: string }) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Fetch the original audio file URL
  useEffect(() => {
    const fetchAudioUrl = async () => {
      try {
        const supabase = createClient()
        
        // Get the audio file record
        const { data: audioFile, error: fileError } = await supabase
          .from('audio_files')
          .select('storage_path, filename')
          .eq('id', audioFileId)
          .single()

        if (fileError) {
          console.error('Database error:', fileError)
          throw new Error(`Database error: ${fileError.message}`)
        }

        if (!audioFile) {
          throw new Error('Audio file not found in database')
        }

        console.log('Audio file data:', audioFile)

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
        console.error('Error fetching audio URL:', error)
        setError('Failed to load original audio')
        setIsLoading(false)
      }
    }

    fetchAudioUrl()
  }, [audioFileId])

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
        setDuration(0)
        setCurrentTime(0)
        setIsPlaying(false)
      }
      return
    }

    if (isMounted) {
      setIsLoading(true)
      setError(null)
      setCurrentTime(0)
      setDuration(0)
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
        console.log(`Initializing waveform for original track with URL: ${cleanUrl}`)

        if (!isMounted || !waveformRef.current) {
          if (isMounted) setIsLoading(false)
          return
        }

        localWaveSurferInstance = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#22C55E40',
          progressColor: '#22C55E',
          height: 40,
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
            setDuration(localWaveSurferInstance?.getDuration() || 0)
            setIsLoading(false)
            console.log('WaveSurfer ready for original track')
          }
        })
        localWaveSurferInstance.on('audioprocess', () => {
          if (isMounted) {
            setCurrentTime(localWaveSurferInstance?.getCurrentTime() || 0)
          }
        })
        localWaveSurferInstance.on('play', () => { if (isMounted) setIsPlaying(true) })
        localWaveSurferInstance.on('pause', () => { if (isMounted) setIsPlaying(false) })
        localWaveSurferInstance.on('finish', () => { if (isMounted) setIsPlaying(false) })
        localWaveSurferInstance.on('error', (err: any) => {
          if (isMounted) {
            console.error('WaveSurfer error for original track:', err)
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
          setTimeout(() => reject(new Error("Waveform loading timed out after 20 seconds")), 20000)
        )

        await Promise.race([loadPromise, timeoutPromise])
        
      } catch (e: any) {
        if (isMounted) {
          console.error('Critical error initializing waveform for original track:', e)
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
        console.log('WaveSurfer instance for original track destroyed on cleanup.')
      }
    }
  }, [audioUrl])

  const togglePlayPause = async () => {
    if (wavesurfer.current && !isLoading && !error) {
      try {
        if (isPlaying) {
          wavesurfer.current.pause()
        } else {
          await wavesurfer.current.play()
        }
      } catch (e: any) {
        console.error('Error toggling playback for original track:', e)
        setError(`Playback error: ${e.message || 'Unknown error'}`)
      }
    } else {
      console.warn('Toggle play attempted for original track but waveform not ready, still loading, or in error state.')
      if (isLoading) toast.error("Waveform is still loading.")
      else if (error) toast.error("Cannot play, waveform has an error.")
      else if (!audioUrl) toast.error("No audio URL to play.")
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
          <div className="w-3 h-3 rounded-full bg-accent"></div>
          <span className="font-medium text-sm">{trackName}</span>
          {error && (
            <span className="text-xs text-red-500" title={error}>⚠️ Error</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlayPause}
            disabled={isLoading || !!error || !audioUrl}
            className="h-8 w-8 p-0 text-accent hover:text-accent/80"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="h-10 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center justify-center px-2">
          <span className="text-xs text-red-600 dark:text-red-400 text-center truncate" title={error}>{error}</span>
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
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-surface-light dark:bg-surface-dark rounded-lg hover:bg-surface-light/80 dark:hover:bg-surface-dark/80 transition-colors">
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
                            className="bg-surface-light dark:bg-surface-dark cursor-pointer hover:bg-surface-light/80 dark:hover:bg-surface-dark/80 transition-colors"
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

                              {/* Original Track Preview */}
                              {job.status === 'completed' && (
                                <div className="pt-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="mb-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Original Track</span>
                                  </div>
                                  <MainTrackPlayer 
                                    jobId={job.id}
                                    audioFileId={job.audio_file_id}
                                    trackName={job.audio_files?.original_name || 'Original Audio'}
                                  />
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
              {/* Original Track */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-heading font-semibold mb-4">Original Track</h3>
                <MainTrackPlayer 
                  jobId={selectedJobForModal.id}
                  audioFileId={selectedJobForModal.audio_file_id}
                  trackName={selectedJobForModal.audio_files?.original_name || 'Original Audio'}
                />
              </div>

              {/* Stems */}
              {selectedJobForModal.result_files && selectedJobForModal.result_files.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-heading font-semibold mb-4">Separated Stems</h3>
                  <div className="grid gap-4">
                    {(() => {
                      // Deduplicate stems by both name AND URL to prevent double waveforms
                      const uniqueStems = selectedJobForModal.result_files.reduce((acc, file, index) => {
                        const stemName = file.stem || file.name || `stem_${index}`
                        const fileUrl = file.url
                        
                        // Only add if we haven't seen this stem name AND URL combination before
                        const existingStem = acc.find(item => 
                          item.stemName === stemName || item.fileUrl === fileUrl
                        )
                        
                        if (!existingStem && fileUrl) {
                          acc.push({
                            stemName,
                            fileUrl,
                            originalIndex: index
                          })
                        }
                        
                        return acc
                      }, [] as Array<{ stemName: string; fileUrl: string; originalIndex: number }>)
                      
                      return uniqueStems.map(({ stemName, fileUrl, originalIndex }) => {
                        if (!fileUrl) {
                          return (
                            <div key={originalIndex} className="border rounded-lg p-3 bg-red-50 dark:bg-red-900/20">
                              <div className="text-sm text-red-600 dark:text-red-400">
                                {stemName}: URL not available
                              </div>
                            </div>
                          )
                        }
                        
                        return (
                          <StemPlayer
                            key={`${selectedJobForModal.id}-${stemName}-${fileUrl.slice(-8)}`}
                            stem={stemName}
                            url={fileUrl}
                            filename={`${selectedJobForModal.audio_files?.original_name?.replace(/\.[^/.]+$/, '')}_${stemName}.wav`}
                          />
                        )
                      })
                    })()}
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