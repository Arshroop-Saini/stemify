"use client"

import { useAuth } from '@/components/auth-provider'
import { SignInButton } from '@/components/auth/sign-in-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

// Audio Stem Component
function AudioStem({ 
  title, 
  audioUrl, 
  color, 
  bgColor, 
  icon 
}: { 
  title: string
  audioUrl: string
  color: string
  bgColor: string
  icon: React.ReactNode
}) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: color,
        progressColor: color,
        height: 32,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      })

      wavesurfer.current.load(audioUrl)

      wavesurfer.current.on('ready', () => {
        setDuration(wavesurfer.current?.getDuration() || 0)
      })

      wavesurfer.current.on('audioprocess', () => {
        setCurrentTime(wavesurfer.current?.getCurrentTime() || 0)
      })

      wavesurfer.current.on('play', () => setIsPlaying(true))
      wavesurfer.current.on('pause', () => setIsPlaying(false))

      return () => {
        wavesurfer.current?.destroy()
      }
    }
  }, [audioUrl, color])

  const togglePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause()
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (wavesurfer.current && waveformRef.current) {
      const rect = waveformRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const progress = x / rect.width
      wavesurfer.current.seekTo(progress)
    }
  }

  return (
    <div className="bg-white/80 dark:bg-gray-50/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-gray-200/30 dark:border-gray-300/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div className={`w-12 h-12 ${bgColor} rounded-xl flex items-center justify-center mr-4 border`}>
            {icon}
          </div>
          <div className="flex-1">
            <h4 className="font-heading font-bold text-gray-900 dark:text-gray-800 text-lg mb-2">{title}</h4>
            {/* Progress Bar Controller */}
            <div className="w-full h-1 bg-gray-200/60 dark:bg-gray-300/60 rounded-full mb-2 cursor-pointer relative">
              <div 
                className={`h-full rounded-full transition-all duration-100`}
                style={{ 
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  backgroundColor: color
                }}
              ></div>
            </div>
            {/* Real Waveform */}
            <div 
              ref={waveformRef} 
              className="cursor-pointer"
              onClick={handleSeek}
            ></div>
          </div>
        </div>
        <button 
          onClick={togglePlayPause}
          className={`w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center hover:opacity-80 transition-colors border ml-3`}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" style={{ color }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" style={{ color }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// Main Audio Track Component (larger version)
function MainAudioTrack() {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#22C55E',
        progressColor: '#22C55E',
        height: 48,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      })

      wavesurfer.current.load('/audio/full_track.mp3')

      wavesurfer.current.on('ready', () => {
        setDuration(wavesurfer.current?.getDuration() || 0)
      })

      wavesurfer.current.on('audioprocess', () => {
        setCurrentTime(wavesurfer.current?.getCurrentTime() || 0)
      })

      wavesurfer.current.on('play', () => setIsPlaying(true))
      wavesurfer.current.on('pause', () => setIsPlaying(false))

      return () => {
        wavesurfer.current?.destroy()
      }
    }
  }, [])

  const togglePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause()
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (wavesurfer.current && waveformRef.current) {
      const rect = waveformRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const progress = x / rect.width
      wavesurfer.current.seekTo(progress)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div>
      {/* Progress Bar Controller */}
      <div className="w-full h-2 bg-gray-200/60 dark:bg-gray-300/60 rounded-full mb-4 cursor-pointer relative">
        <div 
          className="h-full bg-accent rounded-full transition-all duration-100"
          style={{ 
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
          }}
        ></div>
      </div>
      
      {/* Real Waveform */}
      <div 
        ref={waveformRef} 
        className="cursor-pointer"
        onClick={handleSeek}
      ></div>
    </div>
  )
}

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [isScrolling, setIsScrolling] = useState(false)

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // Handle scroll detection to hide/show indicators
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      setIsScrolling(true)
      
      // Clear existing timeout
      clearTimeout(scrollTimeout)
      
      // Set new timeout to show indicators after scrolling stops
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false)
      }, 1500) // Show indicators 1.5 seconds after scrolling stops
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 bg-surface-light dark:bg-surface-dark rounded w-32 mb-4"></div>
          <div className="h-4 bg-surface-light dark:bg-surface-dark rounded w-48"></div>
        </div>
      </div>
    )
  }

  // Don't show homepage content if user is authenticated (will redirect)
  if (user) {
    return null
  }

  const faqs = [
    {
      question: "What audio formats are supported?",
      answer: "We support MP3, WAV, FLAC, and M4A files up to 50MB. Output is available in both WAV and MP3 formats depending on your plan."
    },
    {
      question: "How accurate is the AI separation?",
      answer: "Our HT-Demucs AI model achieves industry-leading separation quality. Results vary by song complexity, but most users are amazed by the clarity of separated stems."
    },
    {
      question: "Can I use separated stems commercially?",
      answer: "You must own the rights to the original song or have permission to create derivative works. Our service provides the technical separation only."
    },
    {
      question: "How long does processing take?",
      answer: "Most songs are processed in 1-3 minutes. Processing time depends on song length and current server load. You'll receive real-time updates during processing."
    },
    {
      question: "What's the difference between standard and fine-tuned models?",
      answer: "Standard model (htdemucs) is fast and good quality. Fine-tuned model (htdemucs_ft) takes 4x longer but produces significantly better separation quality."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access to your plan features until the end of your billing period."
    }
  ]

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="bg-background">
      {/* Hero Section - Full Viewport Height */}
      <section id="hero" className="min-h-screen flex items-center justify-center pt-4 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            {/* Hero Content */}
            <div className="text-center -mt-16">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6 border border-accent/20 font-sans backdrop-blur-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/>
                </svg>
                AI-Powered Audio Separation
              </div>
              
              <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 leading-tight text-foreground">
                Separate Your Music Into
                <span className="text-accent block">Individual Stems</span>
              </h1>
              
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed font-sans">
                Extract vocals, drums, bass, guitar, and piano from any song using state-of-the-art AI. 
                Perfect for remixing, karaoke, and music production.
              </p>
              
              <div className="flex justify-center items-center mb-12">
                <button className="inline-flex items-center px-8 py-3 rounded-full bg-accent hover:bg-accent/90 text-white font-bold text-xl shadow-2xl hover:shadow-accent/25 transform hover:scale-[1.05] transition-all duration-300 ease-out border-0 outline-none focus:outline-none">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>
                  </svg>
                  Try Free
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator - moved higher */}
        <div className={`absolute bottom-16 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-out ${
          isScrolling ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <button 
            onClick={() => scrollToSection('demo')}
            className="flex flex-col items-center space-y-2 animate-bounce hover:animate-none transition-all duration-300 group"
          >
            <span className="text-sm text-muted-foreground font-sans group-hover:text-accent transition-colors">Scroll to explore</span>
            <div className="w-6 h-10 border-2 border-muted-foreground/30 group-hover:border-accent/50 rounded-full flex justify-center transition-colors">
              <div className="w-1 h-3 bg-muted-foreground/50 group-hover:bg-accent/70 rounded-full mt-2 animate-bounce transition-colors"></div>
            </div>
          </button>
        </div>
      </section>

      {/* Demo Audio Separation Section */}
      <section id="demo" className="min-h-screen flex items-center justify-center py-24 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-heading font-bold mb-4 text-foreground">See Stemify in Action</h2>
              <p className="text-lg text-muted-foreground font-sans">Watch how we separate a song into individual stems in real-time</p>
            </div>
            
            {/* Audio Separation Demo */}
            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-100 dark:to-gray-50 rounded-3xl shadow-sm border border-gray-100/50 dark:border-gray-200/50 overflow-hidden">
              {/* Demo Container - Integrated Responsive Layout */}
              <div className="relative px-6 md:px-12 py-12 md:py-20 min-h-[500px] md:min-h-[600px]">
                
                {/* Left Side - Main Track */}
                <div className="absolute left-6 md:left-12 top-1/2 transform -translate-y-1/2 w-80 md:w-96 z-20">
                  <div className="bg-white/80 dark:bg-gray-50/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-sm border border-gray-200/30 dark:border-gray-300/30">
                    <div className="flex items-start mb-6">
                      <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mr-5 border border-accent/15">
                        <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-heading font-bold text-gray-900 dark:text-gray-800 text-xl mb-2">Full Track</h3>
                        <p className="text-gray-500 dark:text-gray-600 font-sans text-sm mb-4">Complete audio with all stems</p>
                        
                        {/* Main Track Audio Component */}
                        <MainAudioTrack />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center - Processing Indicator */}
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                  <div className="w-20 h-20 bg-white/80 dark:bg-gray-50/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-200/30 dark:border-gray-300/30 flex items-center justify-center">
                    <div className="w-8 h-8 animate-spin">
                      <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Right Side - Stem Cards */}
                <div className="absolute right-6 md:right-12 top-1/2 transform -translate-y-1/2 w-72 md:w-80 z-20">
                  <div className="space-y-4">
                    
                    {/* Vocals */}
                    <AudioStem
                      title="Vocals"
                      audioUrl="/audio/vocals.mp3"
                      color="#22C55E"
                      bgColor="bg-accent/10 border-accent/15"
                      icon={
                        <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"/>
                        </svg>
                      }
                    />

                    {/* Drums */}
                    <AudioStem
                      title="Drums"
                      audioUrl="/audio/drums.mp3"
                      color="#EA580C"
                      bgColor="bg-orange-100/80 border-orange-200/50"
                      icon={
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M21 9V4.5M21 9h-4.5M21 9l-5.25-5.25M21 15v4.5M21 15h-4.5M21 15l-5.25 5.25"/>
                        </svg>
                      }
                    />

                    {/* Bass */}
                    <AudioStem
                      title="Bass"
                      audioUrl="/audio/bass.mp3"
                      color="#9333EA"
                      bgColor="bg-purple-100/80 border-purple-200/50"
                      icon={
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6-6m0 0l6 6m-6-6v12a6 6 0 01-12 0v-3"/>
                        </svg>
                      }
                    />

                    {/* Other */}
                    <AudioStem
                      title="Other"
                      audioUrl="/audio/other.mp3"
                      color="#2563EB"
                      bgColor="bg-blue-100/80 border-blue-200/50"
                      icon={
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553z"/>
                        </svg>
                      }
                    />
                  </div>
                </div>

                {/* Connection Lines - Hub and spoke pattern with curved branches */}
                <div className="absolute inset-0 pointer-events-none hidden md:block" style={{ zIndex: 15 }}>
                  {/* Main straight line from Full Track to Center */}
                  <div 
                    className="absolute bg-accent h-0.5 rounded-full"
                    style={{
                      left: '32%', // Right edge of full track
                      top: '50%',
                      width: '18%', // Distance to center
                      transform: 'translateY(-50%)'
                    }}
                  />
                  
                  {/* Curved branch to Vocals */}
                  <div 
                    className="absolute"
                    style={{
                      left: '50%', // From center
                      top: '50%',
                      width: 'calc(100% - 50% - 24px)', // Almost full width to reach stem cards
                      height: '300px',
                      transform: 'translate(0, -50%)'
                    }}
                  >
                    <svg className="w-full h-full">
                      <path 
                        d="M 0 150 Q 60 150 100 50" 
                        stroke="#22C55E" 
                        strokeWidth="2" 
                        fill="none"
                        opacity="0.8"
                      />
                    </svg>
                  </div>
                  
                  {/* Curved branch to Drums */}
                  <div 
                    className="absolute"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: 'calc(100% - 50% - 24px)',
                      height: '150px',
                      transform: 'translate(0, -50%)'
                    }}
                  >
                    <svg className="w-full h-full">
                      <path 
                        d="M 0 75 Q 60 75 100 60" 
                        stroke="#22C55E" 
                        strokeWidth="2" 
                        fill="none"
                        opacity="0.8"
                      />
                    </svg>
                  </div>
                  
                  {/* Curved branch to Bass */}
                  <div 
                    className="absolute"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: 'calc(100% - 50% - 24px)',
                      height: '150px',
                      transform: 'translate(0, -50%)'
                    }}
                  >
                    <svg className="w-full h-full">
                      <path 
                        d="M 0 75 Q 60 75 100 90" 
                        stroke="#22C55E" 
                        strokeWidth="2" 
                        fill="none"
                        opacity="0.8"
                      />
                    </svg>
                  </div>
                  
                  {/* Curved branch to Other */}
                  <div 
                    className="absolute"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: 'calc(100% - 50% - 24px)',
                      height: '300px',
                      transform: 'translate(0, -50%)'
                    }}
                  >
                    <svg className="w-full h-full">
                      <path 
                        d="M 0 150 Q 60 150 100 250" 
                        stroke="#22C55E" 
                        strokeWidth="2" 
                        fill="none"
                        opacity="0.8"
                      />
                    </svg>
                  </div>
                  
                  {/* Center connection point */}
                  <div 
                    className="absolute w-2 h-2 bg-accent rounded-full"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                </div>
              </div>
              
              {/* Bottom Description */}
              <div className="bg-gray-50/30 dark:bg-gray-100/30 px-8 py-6 border-t border-gray-200/30 dark:border-gray-300/30 text-center">
                <p className="text-gray-600 dark:text-gray-700 font-sans text-base mb-2">
                  Separate audio tracks into individual stems, and isolate them into any instrument.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator - positioned outside demo card */}
        <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-out ${
          isScrolling ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <button 
            onClick={() => scrollToSection('features')}
            className="flex flex-col items-center space-y-2 animate-bounce hover:animate-none transition-all duration-300 group"
          >
            <span className="text-sm text-muted-foreground font-sans group-hover:text-accent transition-colors">See features</span>
            <div className="w-6 h-10 border-2 border-muted-foreground/30 group-hover:border-accent/50 rounded-full flex justify-center transition-colors">
              <div className="w-1 h-3 bg-muted-foreground/50 group-hover:bg-accent/70 rounded-full mt-2 animate-bounce transition-colors"></div>
            </div>
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="min-h-screen flex items-center justify-center py-24 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-heading font-bold mb-4 text-foreground">Powerful AI Separation</h2>
              <p className="text-lg text-muted-foreground font-sans">Professional-grade stem separation for every creator</p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="bg-card/30 backdrop-blur-md border border-white/10 dark:border-gray-700/10 shadow-xl hover:shadow-2xl hover:bg-card/50 hover:border-white/20 dark:hover:border-gray-600/20 transition-all duration-500 ease-out hover:scale-[1.02] group">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-accent/20 group-hover:border-accent/40 group-hover:bg-gradient-to-br group-hover:from-accent/30 group-hover:to-accent/20 transition-all duration-500 ease-out">
                    <svg className="w-8 h-8 text-accent group-hover:scale-110 transition-transform duration-500 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"/>
                    </svg>
                  </div>
                  <CardTitle className="font-heading text-xl text-foreground group-hover:text-accent transition-colors duration-500 ease-out">Vocal Isolation</CardTitle>
                  <CardDescription className="text-base font-sans text-muted-foreground">
                    Extract clean vocals or create perfect instrumental versions
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="bg-card/30 backdrop-blur-md border border-white/10 dark:border-gray-700/10 shadow-xl hover:shadow-2xl hover:bg-card/50 hover:border-white/20 dark:hover:border-gray-600/20 transition-all duration-500 ease-out hover:scale-[1.02] group">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-accent/20 group-hover:border-accent/40 group-hover:bg-gradient-to-br group-hover:from-accent/30 group-hover:to-accent/20 transition-all duration-500 ease-out">
                    <svg className="w-8 h-8 text-accent group-hover:scale-110 transition-transform duration-500 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/>
                    </svg>
                  </div>
                  <CardTitle className="font-heading text-xl text-foreground group-hover:text-accent transition-colors duration-500 ease-out">Multi-Stem Separation</CardTitle>
                  <CardDescription className="text-base font-sans text-muted-foreground">
                    Isolate drums, bass, guitar, and piano tracks individually
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="bg-card/30 backdrop-blur-md border border-white/10 dark:border-gray-700/10 shadow-xl hover:shadow-2xl hover:bg-card/50 hover:border-white/20 dark:hover:border-gray-600/20 transition-all duration-500 ease-out hover:scale-[1.02] group">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-accent/20 group-hover:border-accent/40 group-hover:bg-gradient-to-br group-hover:from-accent/30 group-hover:to-accent/20 transition-all duration-500 ease-out">
                    <svg className="w-8 h-8 text-accent group-hover:scale-110 transition-transform duration-500 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/>
                    </svg>
                  </div>
                  <CardTitle className="font-heading text-xl text-foreground group-hover:text-accent transition-colors duration-500 ease-out">AI-Powered</CardTitle>
                  <CardDescription className="text-base font-sans text-muted-foreground">
                    State-of-the-art HT-Demucs technology for highest quality results
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-out ${
          isScrolling ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <button 
            onClick={() => scrollToSection('pricing')}
            className="flex flex-col items-center space-y-2 animate-bounce hover:animate-none transition-all duration-300 group"
          >
            <span className="text-sm text-muted-foreground font-sans group-hover:text-accent transition-colors">View pricing</span>
            <div className="w-6 h-10 border-2 border-muted-foreground/30 group-hover:border-accent/50 rounded-full flex justify-center transition-colors">
              <div className="w-1 h-3 bg-muted-foreground/50 group-hover:bg-accent/70 rounded-full mt-2 animate-bounce transition-colors"></div>
            </div>
          </button>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="min-h-screen flex items-center justify-center py-24 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-heading font-bold mb-4 text-foreground">Simple, Transparent Pricing</h2>
              <p className="text-gray-600 dark:text-gray-300 text-lg mb-12 font-sans">Start free, upgrade when you need more stems and processing time</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Free Plan */}
              <Card className="bg-card/30 backdrop-blur-md border-2 border-white/20 dark:border-gray-700/20 hover:shadow-xl hover:bg-card/50 hover:border-white/30 dark:hover:border-gray-600/30 transition-all duration-500 ease-out hover:scale-[1.02] group">
                <CardHeader className="text-center">
                  <CardTitle className="font-heading text-lg text-foreground">Free</CardTitle>
                  <CardDescription className="font-sans text-muted-foreground">Perfect for trying out</CardDescription>
                  <div className="text-3xl font-bold mt-4 font-mono text-foreground">$0</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 font-sans">5 minutes/month</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm font-sans">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      4 stems (vocals, drums, bass, other)
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Standard model (htdemucs)
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      320kbps MP3 output
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span className="text-gray-500">Watermark included</span>
                    </li>
                  </ul>
                  <Button variant="outline" className="w-full rounded-full border-gray-300/50 hover:border-gray-400/50 bg-card/50 hover:bg-card/70 backdrop-blur-sm font-sans transition-all duration-500 ease-out">Get Started</Button>
                </CardContent>
              </Card>
              
              {/* Creator Plan */}
              <Card className="bg-card/50 backdrop-blur-md border-2 border-accent/50 shadow-2xl scale-105 relative hover:bg-card/70 hover:border-accent/70 transition-all duration-500 ease-out hover:scale-[1.07] group">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-accent text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg font-sans group-hover:shadow-xl transition-shadow duration-500 ease-out">Popular</span>
                </div>
                <CardHeader className="text-center">
                  <CardTitle className="font-heading text-lg text-foreground">Creator</CardTitle>
                  <CardDescription className="font-sans text-muted-foreground">For regular users</CardDescription>
                  <div className="text-3xl font-bold mt-4 text-accent font-mono">$9</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 font-sans">60 minutes/month</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm font-sans">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      6 stems (+ guitar, piano)
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      6-stem model (htdemucs_6s)
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      WAV + 320kbps MP3 output
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Fine-tuned model option
                    </li>
                  </ul>
                  <Button className="w-full rounded-full bg-accent hover:bg-accent/90 hover:shadow-xl shadow-lg font-sans text-white transition-all duration-500 ease-out">Get Started</Button>
                </CardContent>
              </Card>
              
              {/* Studio Plan */}
              <Card className="bg-card/30 backdrop-blur-md border-2 border-white/20 dark:border-gray-700/20 hover:shadow-xl hover:bg-card/50 hover:border-white/30 dark:hover:border-gray-600/30 transition-all duration-500 ease-out hover:scale-[1.02] group">
                <CardHeader className="text-center">
                  <CardTitle className="font-heading text-lg text-foreground">Studio</CardTitle>
                  <CardDescription className="font-sans text-muted-foreground">High volume processing</CardDescription>
                  <div className="text-3xl font-bold mt-4 font-mono text-foreground">$19</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 font-sans">200 minutes/month</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm font-sans">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      6 stems (+ guitar, piano)
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      6-stem model (htdemucs_6s)
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      WAV + 320kbps MP3 output
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Fine-tuned model option
                    </li>
                  </ul>
                  <Button variant="outline" className="w-full rounded-full border-gray-300/50 hover:border-gray-400/50 bg-card/50 hover:bg-card/70 backdrop-blur-sm font-sans transition-all duration-500 ease-out">Get Started</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-out ${
          isScrolling ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <button 
            onClick={() => scrollToSection('social-proof')}
            className="flex flex-col items-center space-y-2 animate-bounce hover:animate-none transition-all duration-300 group"
          >
            <span className="text-sm text-muted-foreground font-sans group-hover:text-accent transition-colors">See testimonials</span>
            <div className="w-6 h-10 border-2 border-muted-foreground/30 group-hover:border-accent/50 rounded-full flex justify-center transition-colors">
              <div className="w-1 h-3 bg-muted-foreground/50 group-hover:bg-accent/70 rounded-full mt-2 animate-bounce transition-colors"></div>
            </div>
          </button>
        </div>
      </section>

      {/* Social Proof & Testimonials Section */}
      <section id="social-proof" className="min-h-screen flex items-center justify-center py-24 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            {/* Social Proof */}
            <div className="text-center mb-16">
              <div className="bg-card/20 backdrop-blur-sm rounded-2xl p-8 border border-white/10 dark:border-gray-700/10">
                <h3 className="text-xl font-heading font-semibold mb-6 text-foreground">Trusted by creators worldwide</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent font-mono">10K+</div>
                    <div className="text-sm text-muted-foreground font-sans">Songs Separated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent font-mono">5K+</div>
                    <div className="text-sm text-muted-foreground font-sans">Happy Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent font-mono">99.9%</div>
                    <div className="text-sm text-muted-foreground font-sans">Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent font-mono">4.9★</div>
                    <div className="text-sm text-muted-foreground font-sans">User Rating</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            <div className="mb-16">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-heading font-bold mb-4 text-foreground">What creators are saying</h2>
                <p className="text-lg text-muted-foreground font-sans">See how Stemify is helping musicians and producers worldwide</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                <Card className="bg-card/30 backdrop-blur-md border border-white/10 dark:border-gray-700/10 hover:bg-card/50 transition-all duration-500 ease-out">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center mr-4">
                        <span className="text-accent font-heading font-bold">DJ</span>
                      </div>
                      <div>
                        <div className="font-heading font-semibold text-foreground">Alex Chen</div>
                        <div className="text-sm text-muted-foreground font-sans">Music Producer</div>
                      </div>
                    </div>
                    <p className="text-muted-foreground font-sans italic">"Stemify has revolutionized my workflow. The quality is incredible and it saves me hours of manual editing."</p>
                    <div className="flex mt-4">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 backdrop-blur-md border border-white/10 dark:border-gray-700/10 hover:bg-card/50 transition-all duration-500 ease-out">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center mr-4">
                        <span className="text-accent font-heading font-bold">SM</span>
                      </div>
                      <div>
                        <div className="font-heading font-semibold text-foreground">Sarah Martinez</div>
                        <div className="text-sm text-muted-foreground font-sans">Content Creator</div>
                      </div>
                    </div>
                    <p className="text-muted-foreground font-sans italic">"Perfect for creating karaoke versions and remixes. The AI separation is so clean, it's like magic!"</p>
                    <div className="flex mt-4">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 backdrop-blur-md border border-white/10 dark:border-gray-700/10 hover:bg-card/50 transition-all duration-500 ease-out">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center mr-4">
                        <span className="text-accent font-heading font-bold">MJ</span>
                      </div>
                      <div>
                        <div className="font-heading font-semibold text-foreground">Mike Johnson</div>
                        <div className="text-sm text-muted-foreground font-sans">Audio Engineer</div>
                      </div>
                    </div>
                    <p className="text-muted-foreground font-sans italic">"As a professional, I'm impressed by the quality. Stemify delivers studio-grade results in minutes."</p>
                    <div className="flex mt-4">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-out ${
          isScrolling ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <button 
            onClick={() => scrollToSection('faq')}
            className="flex flex-col items-center space-y-2 animate-bounce hover:animate-none transition-all duration-300 group"
          >
            <span className="text-sm text-muted-foreground font-sans group-hover:text-accent transition-colors">Got questions?</span>
            <div className="w-6 h-10 border-2 border-muted-foreground/30 group-hover:border-accent/50 rounded-full flex justify-center transition-colors">
              <div className="w-1 h-3 bg-muted-foreground/50 group-hover:bg-accent/70 rounded-full mt-2 animate-bounce transition-colors"></div>
            </div>
          </button>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="min-h-screen flex items-center justify-center py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-heading font-bold mb-3 text-foreground">Got Questions? 🤔</h2>
              <p className="text-lg text-muted-foreground font-sans">We've got answers! Here's everything you need to know.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
              {faqs.map((faq, index) => (
                <Card key={index} className="bg-card/30 backdrop-blur-md border border-white/10 dark:border-gray-700/10 hover:bg-card/40 transition-all duration-300 ease-out">
                  <CardContent className="p-0">
                    <button
                      className="w-full p-4 text-left flex items-center justify-between hover:bg-card/20 transition-colors duration-300 ease-out"
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    >
                      <h3 className="font-heading font-semibold text-foreground pr-4 text-sm">{faq.question}</h3>
                      <svg
                        className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ease-out flex-shrink-0 ${
                          openFaq === index ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    {openFaq === index && (
                      <div className="px-4 pb-4 pt-0">
                        <p className="text-muted-foreground font-sans leading-relaxed text-sm">{faq.answer}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="text-center mt-8">
              <p className="text-muted-foreground font-sans text-sm">
                Still have questions? <span className="text-accent font-medium cursor-pointer hover:underline">Contact our support team</span> 💬
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
