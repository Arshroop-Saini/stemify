"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { storageService } from '@/lib/supabase-storage'
import { cn } from '@/lib/utils'
import WaveSurfer from 'wavesurfer.js'

interface AudioFile {
  id: string
  filename: string
  original_name: string
  file_size: number
  duration?: number
  format: string
  storage_path: string
  upload_status: string
  created_at: string
  user_id: string
}

interface AudioPreviewProps {
  file: AudioFile
  className?: string
  autoLoad?: boolean
}

export function AudioPreview({ 
  file, 
  className,
  autoLoad = true 
}: AudioPreviewProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState([70])
  const [playbackRate, setPlaybackRate] = useState([1])
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Format time display
  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  // Initialize WaveSurfer
  const initializeWaveSurfer = useCallback(async () => {
    if (!waveformRef.current || !audioUrl) return

    try {
      setIsLoading(true)
      setError(null)

      // Destroy existing instance
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
      }

      // Create new WaveSurfer instance
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#22C55E40', // Accent color with transparency
        progressColor: '#22C55E', // Solid accent color
        cursorColor: '#22C55E',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 60,
        normalize: true,
        interact: true,
        hideScrollbar: true,
        backend: 'WebAudio'
      })

      // Event listeners
      wavesurfer.current.on('ready', () => {
        setDuration(wavesurfer.current?.getDuration() || 0)
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
        setError('Failed to load audio file')
        setIsLoading(false)
      })

      // Load audio
      await wavesurfer.current.load(audioUrl)

    } catch (err) {
      console.error('Failed to initialize WaveSurfer:', err)
      setError('Failed to initialize audio player')
      setIsLoading(false)
    }
  }, [audioUrl])

  // Load audio URL
  const loadAudioUrl = useCallback(async () => {
    try {
      const url = await storageService.getDownloadUrl(file.storage_path)
      if (url) {
        setAudioUrl(url)
      } else {
        setError('Failed to get audio URL')
      }
    } catch (err) {
      console.error('Failed to get audio URL:', err)
      setError('Failed to load audio file')
    }
  }, [file.storage_path])

  // Initialize on mount
  useEffect(() => {
    if (autoLoad) {
      loadAudioUrl()
    }
  }, [autoLoad, loadAudioUrl])

  // Initialize WaveSurfer when URL is available
  useEffect(() => {
    if (audioUrl) {
      initializeWaveSurfer()
    }

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy()
      }
    }
  }, [audioUrl, initializeWaveSurfer])

  // Update volume
  useEffect(() => {
    if (wavesurfer.current) {
      wavesurfer.current.setVolume(volume[0] / 100)
    }
  }, [volume])

  // Update playback rate
  useEffect(() => {
    if (wavesurfer.current) {
      wavesurfer.current.setPlaybackRate(playbackRate[0])
    }
  }, [playbackRate])

  // Control functions
  const handlePlayPause = useCallback(() => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause()
    }
  }, [])

  const handleStop = useCallback(() => {
    if (wavesurfer.current) {
      wavesurfer.current.stop()
    }
  }, [])

  const handleSeekToStart = useCallback(() => {
    if (wavesurfer.current) {
      wavesurfer.current.seekTo(0)
    }
  }, [])

  const handleSeekToEnd = useCallback(() => {
    if (wavesurfer.current) {
      wavesurfer.current.seekTo(1)
    }
  }, [])

  // Manual load trigger
  const handleLoad = useCallback(() => {
    if (!audioUrl) {
      loadAudioUrl()
    }
  }, [audioUrl, loadAudioUrl])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="font-heading text-lg truncate">
              {file.original_name}
            </CardTitle>
            <div className="flex items-center space-x-3 text-sm text-muted-foreground font-mono mt-1">
              <span>{formatFileSize(file.file_size)}</span>
              {file.duration && <span>{formatTime(file.duration)}</span>}
              <Badge variant="secondary" className="text-xs">
                {file.format.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          {!audioUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLoad}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load Preview'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 font-sans mb-4">{error}</p>
            <Button variant="outline" onClick={() => {
              setError(null)
              handleLoad()
            }}>
              Try Again
            </Button>
          </div>
        ) : !audioUrl ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/>
              </svg>
            </div>
            <p className="text-muted-foreground font-sans">Click "Load Preview" to preview this audio file</p>
          </div>
        ) : (
          <>
            {/* Waveform Player */}
            <div className="border rounded-lg p-4 bg-surface-light dark:bg-surface-dark shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent"></div>
                  <span className="font-medium text-sm">Audio Preview</span>
                  {error && (
                    <span className="text-xs text-red-500" title={error}>⚠️ Error</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePlayPause}
                    disabled={isLoading || !!error}
                    className="h-8 w-8 p-0 text-accent hover:text-accent/80"
                  >
                    {isPlaying ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"/>
                      </svg>
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
                  <div className="relative">
                    <div 
                      ref={waveformRef} 
                      className={cn(
                        "cursor-pointer min-h-[60px] rounded",
                        isLoading && "animate-pulse bg-gray-200 dark:bg-gray-700"
                      )}
                    />
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          <span className="text-xs font-sans">Loading waveform...</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    {isLoading && <span className="text-gray-400">Loading audio...</span>}
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}
            </div>



            {/* Advanced Controls */}
            <div className="border rounded-lg p-5 bg-surface-light dark:bg-surface-dark shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m0 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/>
                  </svg>
                </div>
                <h4 className="font-heading font-semibold text-base">Audio Controls</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Volume Control */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.71-1.59-1.59V9.91c0-.88.71-1.59 1.59-1.59h2.24z"/>
                      </svg>
                      <label className="text-sm font-medium">Volume</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-mono bg-accent/10 text-accent px-2 py-1 rounded-md min-w-[48px] text-center">
                        {volume[0]}%
                      </span>
                    </div>
                  </div>
                  <div className="px-1">
                    <Slider
                      value={volume}
                      onValueChange={setVolume}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Playback Speed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M9 12.75h6m-6 3h6"/>
                      </svg>
                      <label className="text-sm font-medium">Speed</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-mono bg-accent/10 text-accent px-2 py-1 rounded-md min-w-[48px] text-center">
                        {playbackRate[0]}x
                      </span>
                    </div>
                  </div>
                  <div className="px-1">
                    <Slider
                      value={playbackRate}
                      onValueChange={setPlaybackRate}
                      min={0.5}
                      max={2}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
} 