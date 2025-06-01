"use client"

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Loader2, Play, Music, Clock, Sparkles, Mic, Drum, Guitar, Piano, Volume2, Zap, Crown, Timer, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import { SUBSCRIPTION_TIERS, SIEVE_CONFIG } from '@/lib/constants'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { getUserStats } from '@/lib/user-stats'

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

export function SeparationInterface({ selectedFile, className, onSeparationComplete }: SeparationInterfaceProps) {
  const { user } = useAuth()
  const [selectedStems, setSelectedStems] = useState<string[]>(['vocals', 'drums', 'bass', 'other'])
  const [quality, setQuality] = useState<'standard' | 'pro'>('standard')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentJob, setCurrentJob] = useState<SeparationJob | null>(null)
  const [userTier, setUserTier] = useState<'free' | 'creator' | 'studio'>('free')

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
        
        setCurrentJob({
          jobId: result.jobId,
          status: 'completed',
          progress: 100,
          selectedStems,
          quality,
          resultFiles: result.resultFiles,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        })
        
        setIsProcessing(false) // Reset processing state immediately
        toast.success('Separation completed! 🎉')
        onSeparationComplete?.()
        
        return // Don't start polling since it's already done
      }
      
      // Handle asynchronous processing case
      toast.success('Separation job started! ⚡')
      
      // Start polling for job status
      setCurrentJob({
        jobId: result.jobId,
        status: 'pending',
        progress: 0,
        selectedStems,
        quality,
        createdAt: new Date().toISOString()
      })

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
        setCurrentJob(prev => prev ? { 
          ...prev, 
          ...job,
          // Map API response to expected format
          resultFiles: job.resultFiles || job.result_files
        } : null)

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

  const estimate = calculateEstimate()
  const tierConfig = SUBSCRIPTION_TIERS[userTier]

  if (!selectedFile) {
    return (
      <Card className={cn("", className)}>
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
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Current Job Progress */}
      {currentJob && (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Loader2 className={cn(
                  "w-5 h-5",
                  currentJob.status === 'processing' ? 'animate-spin text-accent' : 'text-gray-400'
                )} />
                Processing: {selectedFile.original_name}
              </CardTitle>
              <Badge variant={
                currentJob.status === 'completed' ? 'default' :
                currentJob.status === 'failed' ? 'destructive' :
                'secondary'
              }>
                {currentJob.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={currentJob.progress} className="w-full" />
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>{currentJob.progress}% complete</span>
              <span>{currentJob.selectedStems.length} stems • {currentJob.quality} quality</span>
            </div>
            
            {currentJob.status === 'completed' && currentJob.resultFiles && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Download Results:</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewSeparation}
                    className="text-accent border-accent hover:bg-accent hover:text-white"
                  >
                    New Separation
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {currentJob.resultFiles.map((file) => (
                    <Button
                      key={file.stem}
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        // Create a proper download
                        const link = document.createElement('a')
                        link.href = file.url
                        link.download = `${selectedFile.original_name.replace(/\.[^/.]+$/, '')}_${file.stem}.wav`
                        link.target = '_blank'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        toast.success(`Downloading ${file.stem} stem`)
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {file.stem}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Separation Configuration */}
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
                        : "border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark hover:border-gray-300 dark:hover:border-gray-600",
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
                      <div className="text-right">
                        <Badge variant="secondary" className="font-mono text-xs">
                          htdemucs
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">~2-3 min</div>
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
                      <div className="text-right">
                        <Badge variant="secondary" className="font-mono text-xs">
                          htdemucs_ft
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">~8-12 min</div>
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
    </div>
  )
} 