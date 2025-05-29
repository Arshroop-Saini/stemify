"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import WaveSurfer from 'wavesurfer.js'

interface StemTrack {
  id: string
  name: string
  audioUrl: string
  color: string
  type: 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'other'
}

interface MultiTrackPreviewProps {
  originalTrack: {
    name: string
    audioUrl: string
  }
  stems: StemTrack[]
  className?: string
}

interface TrackState {
  wavesurfer: WaveSurfer | null
  isPlaying: boolean
  volume: number
  isMuted: boolean
  isSolo: boolean
  isLoading: boolean
  error: string | null
}

export function MultiTrackPreview({ 
  originalTrack, 
  stems, 
  className 
}: MultiTrackPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [masterVolume, setMasterVolume] = useState([80])
  const [playbackRate, setPlaybackRate] = useState([1])
  
  // Track states
  const [originalState, setOriginalState] = useState<TrackState>({
    wavesurfer: null,
    isPlaying: false,
    volume: 80,
    isMuted: false,
    isSolo: false,
    isLoading: false,
    error: null
  })
  
  const [stemStates, setStemStates] = useState<Record<string, TrackState>>({})
  
  // Refs for waveform containers
  const originalRef = useRef<HTMLDivElement>(null)
  const stemRefs = useRef<Record<string, HTMLDivElement>>({})

  // Format time display
  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  // Initialize WaveSurfer for original track
  const initializeOriginal = useCallback(async () => {
    if (!originalRef.current || !originalTrack.audioUrl) return

    try {
      setOriginalState(prev => ({ ...prev, isLoading: true, error: null }))

      if (originalState.wavesurfer) {
        originalState.wavesurfer.destroy()
      }

      const wavesurfer = WaveSurfer.create({
        container: originalRef.current,
        waveColor: '#64748B',
        progressColor: '#475569',
        cursorColor: '#334155',
        barWidth: 1,
        barGap: 1,
        height: 60,
        normalize: true,
        interact: true,
        hideScrollbar: true
      })

      wavesurfer.on('ready', () => {
        setDuration(wavesurfer.getDuration())
        setOriginalState(prev => ({
          ...prev,
          wavesurfer,
          isLoading: false
        }))
      })

      wavesurfer.on('audioprocess', () => {
        setCurrentTime(wavesurfer.getCurrentTime())
      })

      wavesurfer.on('error', (err) => {
        console.error('Original track error:', err)
        setOriginalState(prev => ({
          ...prev,
          error: 'Failed to load original track',
          isLoading: false
        }))
      })

      await wavesurfer.load(originalTrack.audioUrl)

    } catch (err) {
      console.error('Failed to initialize original track:', err)
      setOriginalState(prev => ({
        ...prev,
        error: 'Failed to initialize original track',
        isLoading: false
      }))
    }
  }, [originalTrack.audioUrl, originalState.wavesurfer])

  // Initialize WaveSurfer for stems
  const initializeStems = useCallback(async () => {
    const newStemStates: Record<string, TrackState> = {}

    for (const stem of stems) {
      const container = stemRefs.current[stem.id]
      if (!container || !stem.audioUrl) continue

      try {
        const wavesurfer = WaveSurfer.create({
          container,
          waveColor: stem.color,
          progressColor: stem.color,
          cursorColor: stem.color,
          barWidth: 1,
          barGap: 1,
          height: 50,
          normalize: true,
          interact: true,
          hideScrollbar: true
        })

        newStemStates[stem.id] = {
          wavesurfer,
          isPlaying: false,
          volume: 80,
          isMuted: false,
          isSolo: false,
          isLoading: true,
          error: null
        }

        wavesurfer.on('ready', () => {
          setStemStates(prev => ({
            ...prev,
            [stem.id]: {
              ...prev[stem.id],
              isLoading: false
            }
          }))
        })

        wavesurfer.on('error', (err) => {
          console.error(`Stem ${stem.name} error:`, err)
          setStemStates(prev => ({
            ...prev,
            [stem.id]: {
              ...prev[stem.id],
              error: `Failed to load ${stem.name}`,
              isLoading: false
            }
          }))
        })

        await wavesurfer.load(stem.audioUrl)

      } catch (err) {
        console.error(`Failed to initialize stem ${stem.name}:`, err)
        newStemStates[stem.id] = {
          wavesurfer: null,
          isPlaying: false,
          volume: 80,
          isMuted: false,
          isSolo: false,
          isLoading: false,
          error: `Failed to initialize ${stem.name}`
        }
      }
    }

    setStemStates(newStemStates)
  }, [stems])

  // Initialize all tracks
  useEffect(() => {
    initializeOriginal()
    initializeStems()

    return () => {
      // Cleanup
      if (originalState.wavesurfer) {
        originalState.wavesurfer.destroy()
      }
      Object.values(stemStates).forEach(state => {
        if (state.wavesurfer) {
          state.wavesurfer.destroy()
        }
      })
    }
  }, []) // Only run once on mount

  // Sync playback across all tracks
  const syncPlayback = useCallback((action: 'play' | 'pause' | 'stop' | 'seek', seekPosition?: number) => {
    const allWavesurfers = [
      originalState.wavesurfer,
      ...Object.values(stemStates).map(state => state.wavesurfer)
    ].filter(Boolean) as WaveSurfer[]

    allWavesurfers.forEach(ws => {
      try {
        if (action === 'play') {
          ws.play()
        } else if (action === 'pause') {
          ws.pause()
        } else if (action === 'stop') {
          ws.stop()
        } else if (action === 'seek' && seekPosition !== undefined) {
          ws.seekTo(seekPosition)
        }
      } catch (err) {
        console.error('Sync error:', err)
      }
    })

    setIsPlaying(action === 'play')
  }, [originalState.wavesurfer, stemStates])

  // Master controls
  const handlePlayPause = useCallback(() => {
    syncPlayback(isPlaying ? 'pause' : 'play')
  }, [isPlaying, syncPlayback])

  const handleStop = useCallback(() => {
    syncPlayback('stop')
  }, [syncPlayback])

  // Volume controls
  const updateStemVolume = useCallback((stemId: string, volume: number) => {
    setStemStates(prev => ({
      ...prev,
      [stemId]: {
        ...prev[stemId],
        volume
      }
    }))

    const state = stemStates[stemId]
    if (state?.wavesurfer) {
      state.wavesurfer.setVolume(volume / 100)
    }
  }, [stemStates])

  const toggleStemMute = useCallback((stemId: string) => {
    setStemStates(prev => {
      const newMuted = !prev[stemId].isMuted
      const state = prev[stemId]
      
      if (state.wavesurfer) {
        state.wavesurfer.setVolume(newMuted ? 0 : state.volume / 100)
      }

      return {
        ...prev,
        [stemId]: {
          ...prev[stemId],
          isMuted: newMuted
        }
      }
    })
  }, [])

  const toggleStemSolo = useCallback((stemId: string) => {
    setStemStates(prev => {
      const newStates = { ...prev }
      const targetSolo = !prev[stemId].isSolo

      // If activating solo, mute all others
      if (targetSolo) {
        Object.keys(newStates).forEach(id => {
          const state = newStates[id]
          if (id !== stemId && state.wavesurfer) {
            state.wavesurfer.setVolume(0)
            newStates[id] = { ...state, isSolo: false }
          }
        })
        
        // Mute original
        if (originalState.wavesurfer) {
          originalState.wavesurfer.setVolume(0)
        }
        
        // Unmute target
        const targetState = newStates[stemId]
        if (targetState.wavesurfer) {
          targetState.wavesurfer.setVolume(targetState.volume / 100)
        }
      } else {
        // Deactivating solo - restore all volumes
        Object.keys(newStates).forEach(id => {
          const state = newStates[id]
          if (state.wavesurfer && !state.isMuted) {
            state.wavesurfer.setVolume(state.volume / 100)
          }
        })
        
        // Restore original
        if (originalState.wavesurfer && !originalState.isMuted) {
          originalState.wavesurfer.setVolume(originalState.volume / 100)
        }
      }

      newStates[stemId] = { ...newStates[stemId], isSolo: targetSolo }
      return newStates
    })
  }, [originalState])

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="font-heading">Multi-Track Preview</CardTitle>
        
        {/* Master Controls */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center space-x-2">
            <Button
              onClick={handlePlayPause}
              className="bg-accent hover:bg-accent/90 text-white"
              size="lg"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"/>
                </svg>
              )}
            </Button>

            <Button variant="outline" onClick={handleStop}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"/>
              </svg>
            </Button>
          </div>

          <div className="flex items-center space-x-4 text-sm font-mono text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Original Track */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800">
                Original
              </Badge>
              <span className="font-medium text-foreground">{originalTrack.name}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newMuted = !originalState.isMuted
                  setOriginalState(prev => ({ ...prev, isMuted: newMuted }))
                  if (originalState.wavesurfer) {
                    originalState.wavesurfer.setVolume(newMuted ? 0 : originalState.volume / 100)
                  }
                }}
                className={cn(
                  "w-8 h-8 p-0",
                  originalState.isMuted && "bg-red-100 dark:bg-red-900/20 text-red-600"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  {originalState.isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.71-1.59-1.59V9.91c0-.88.71-1.59 1.59-1.59h2.24z"/>
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.71-1.59-1.59V9.91c0-.88.71-1.59 1.59-1.59h2.24z"/>
                  )}
                </svg>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div 
              ref={originalRef}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
            />
            {originalState.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Stem Tracks */}
        <div className="space-y-4">
          <h4 className="font-heading font-medium text-foreground">Separated Stems</h4>
          
          {stems.map((stem) => {
            const state = stemStates[stem.id] || {
              wavesurfer: null,
              isPlaying: false,
              volume: 80,
              isMuted: false,
              isSolo: false,
              isLoading: false,
              error: null
            }

            return (
              <div key={stem.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{ borderColor: stem.color, color: stem.color }}
                    >
                      {stem.name}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Volume Slider */}
                    <div className="flex items-center space-x-2 w-24">
                      <Slider
                        value={[state.volume]}
                        onValueChange={(value) => updateStemVolume(stem.id, value[0])}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                    </div>
                    
                    {/* Solo Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStemSolo(stem.id)}
                      className={cn(
                        "w-8 h-8 p-0 text-xs font-bold",
                        state.isSolo && "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600"
                      )}
                    >
                      S
                    </Button>
                    
                    {/* Mute Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStemMute(stem.id)}
                      className={cn(
                        "w-8 h-8 p-0",
                        state.isMuted && "bg-red-100 dark:bg-red-900/20 text-red-600"
                      )}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        {state.isMuted ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.71-1.59-1.59V9.91c0-.88.71-1.59 1.59-1.59h2.24z"/>
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.71-1.59-1.59V9.91c0-.88.71-1.59 1.59-1.59h2.24z"/>
                        )}
                      </svg>
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <div 
                    ref={(el) => {
                      if (el) stemRefs.current[stem.id] = el
                    }}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
                  />
                  {state.isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    </div>
                  )}
                  {state.error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
} 