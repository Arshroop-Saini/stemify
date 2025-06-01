"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { FileUpload } from '@/components/file-upload'
import { FileLibrary } from '@/components/file-library'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import { useCredits } from '@/hooks/use-credits'
import type { UploadResult } from '@/lib/supabase-storage'
import { AudioPreview } from '@/components/audio-preview'
import { SeparationInterface } from '@/components/separation-interface'
import { getUserStats, getTierDisplayName, type UserStats } from '@/lib/user-stats'
import { Clock, Music, Sparkles, Crown, Play, Coins, Settings } from 'lucide-react'
import Link from 'next/link'

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

export default function DashboardPage() {
  const { user } = useAuth()
  const { balance: creditsBalance, totalCredits, loading: creditsLoading, refreshBalance } = useCredits()
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Load user statistics
  useEffect(() => {
    if (user) {
      loadUserStats()
    }
  }, [user])

  const loadUserStats = async () => {
    if (!user) return
    
    try {
      setStatsLoading(true)
      const stats = await getUserStats(user.id)
      setUserStats(stats)
    } catch (error) {
      console.error('Failed to load user stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
          <p className="text-gray-600 dark:text-gray-400">
            You need to be signed in to access the dashboard.
          </p>
        </div>
      </div>
    )
  }

  const handleUploadComplete = (result: UploadResult) => {
    if (result.success) {
      setRefreshTrigger(prev => prev + 1)
      // Immediate refresh for file count
      loadUserStats()
      
      // Additional refresh to ensure database consistency
      setTimeout(() => {
        loadUserStats()
      }, 1000)
    }
  }

  const handleFileSelected = (file: AudioFile) => {
    setSelectedFile(file)
  }

  const handleFileDeleted = () => {
    setRefreshTrigger(prev => prev + 1)
    setSelectedFile(null)
  }

  const handleSeparationComplete = () => {
    // Refresh user stats when separation completes
    // Use immediate refresh first
    loadUserStats()
    
    // Also trigger a refresh for other components
    setRefreshTrigger(prev => prev + 1)
    
    // Add staggered refreshes to catch any async database updates
    setTimeout(() => {
      loadUserStats()
    }, 2000)
    
    setTimeout(() => {
      loadUserStats()
    }, 5000)
  }

  const handleTierChange = (newTier: 'free' | 'creator' | 'studio') => {
    // Refresh all data when tier changes
    loadUserStats()
    setRefreshTrigger(prev => prev + 1)
  }

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
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 pt-24 pb-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Welcome back, {user.user_metadata?.name?.split(' ')[0] || 'there'}! 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Upload audio files and separate them into individual stems using AI
            </p>
          </div>

          {/* Upgrade Banner for Free Users */}
          {userStats?.subscriptionTier === 'free' && (
            <Card className="mb-8 border-2 border-accent/20 bg-gradient-to-r from-accent/5 to-accent/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-accent/10">
                      <Crown className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg font-heading font-bold text-foreground">Unlock More Features</h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Upgrade to Creator or Studio plan for more processing time, better quality, and advanced features
                      </p>
                    </div>
                  </div>
                  <Link href="/subscriptions">
                    <Button className="bg-accent hover:bg-accent/90 text-white font-medium">
                      Upgrade Plan
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-accent" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Audio Content</p>
                    <p className="text-2xl font-bold font-mono">
                      {statsLoading ? '...' : `${userStats?.minutesUsed || 0} / ${userStats?.minutesLimit || 5} min`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Music className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Files Uploaded</p>
                    <p className="text-2xl font-bold font-mono">
                      {statsLoading ? '...' : userStats?.filesUploaded || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Sparkles className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Separations</p>
                    <p className="text-2xl font-bold font-mono">
                      {statsLoading ? '...' : userStats?.completedSeparations || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Coins className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Credits Available</p>
                    <p className="text-2xl font-bold font-mono">
                      {creditsLoading ? '...' : `${creditsBalance.toFixed(1)} / ${totalCredits.toFixed(1)}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* File Upload Section */}
          <div className="mb-6">
            <FileUpload onUploadComplete={handleUploadComplete} />
          </div>

          {/* Your Audio Files and Audio Preview Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Left - File Library */}
            <div>
              <FileLibrary 
                onFileSelect={handleFileSelected}
                refreshTrigger={refreshTrigger}
                selectedFile={selectedFile}
                onFileDeleted={handleFileDeleted}
              />
            </div>

            {/* Right - Audio Preview */}
            <div>
              {selectedFile ? (
                <AudioPreview file={selectedFile} />
              ) : (
                <Card className="h-full flex items-center justify-center border-dashed border-gray-300 dark:border-gray-600">
                  <CardContent className="text-center py-12">
                    <Play className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-heading font-medium text-gray-600 dark:text-gray-300 mb-2">
                      No file selected
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Upload or select a file to preview
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Separation Interface */}
          <div className="mb-6">
            <SeparationInterface
              selectedFile={selectedFile}
              onSeparationComplete={handleSeparationComplete}
            />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 