"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/components/auth-provider'
import { useCredits } from '@/hooks/use-credits'
import { getUserStats, getTierDisplayName, type UserStats } from '@/lib/user-stats'
import { Crown, Coins, ArrowLeft } from 'lucide-react'
import { SubscriptionManager } from '@/components/subscription-manager'
import { CreditPurchase } from '@/components/credit-purchase'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function SettingsPage() {
  const { user } = useAuth()
  const { refreshBalance } = useCredits()
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

  const handleTierChange = (newTier: 'free' | 'creator' | 'studio') => {
    // Refresh all data when tier changes
    loadUserStats()
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
          <p className="text-gray-600 dark:text-gray-400">
            You need to be signed in to access settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-8">
          {/* Header with Back Button */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Account Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage your subscription, billing, and credit packages
            </p>
          </div>

          {/* Current Plan Overview */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {statsLoading ? '...' : getTierDisplayName(userStats?.subscriptionTier || 'free')} Plan
                    </h3>
                    <p className="text-muted-foreground">
                      {statsLoading ? 'Loading...' : `${userStats?.minutesUsed || 0} / ${userStats?.minutesLimit || 5} minutes used this month`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-accent">
                      {userStats?.subscriptionTier === 'free' ? 'Free' : 
                       userStats?.subscriptionTier === 'creator' ? '$9/mo' : '$19/mo'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Management */}
          <div className="mb-8">
            <SubscriptionManager 
              currentTier={userStats?.subscriptionTier || 'free'}
              onTierChange={handleTierChange}
            />
          </div>

          {/* Credit Purchase Section */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  Purchase Additional Credits
                </CardTitle>
                <CardDescription>
                  Need more processing time? Buy credit packages that never expire.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreditPurchase 
                  onPurchaseComplete={() => {
                    // Refresh credits and stats when purchase completes
                    refreshBalance()
                    loadUserStats()
                  }}
                  showBalance={false} // Don't show balance since it's already in the overview
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 