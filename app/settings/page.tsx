"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/components/auth-provider'
import { useCredits } from '@/hooks/use-credits'
import { getUserStats, getTierDisplayName, type UserStats } from '@/lib/user-stats'
import { STRIPE_CREDIT_PACKAGES } from '@/lib/stripe-config'
import { redirectToCheckout } from '@/lib/stripe-client'
import { Crown, ArrowLeft, Wallet, Loader2, ExternalLink, Settings } from 'lucide-react'
import { BillingPortalButton } from '@/components/billing-portal-button'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'

export default function SettingsPage() {
  const { user } = useAuth()
  const { refreshBalance } = useCredits()
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [creditLoading, setCreditLoading] = useState<string | null>(null)

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

  const handleCreditPurchase = async (packageKey: keyof typeof STRIPE_CREDIT_PACKAGES) => {
    if (!user) {
      toast.error('Please sign in to purchase credits')
      return
    }

    setCreditLoading(packageKey)
    
    try {
      const response = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageKey: packageKey,
          userId: user.id
        })
      })

      const data = await response.json()

      if (response.ok && data.sessionId) {
        // Redirect to Stripe checkout
        await redirectToCheckout(data.sessionId)
      } else {
        toast.error(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Credit purchase error:', error)
      toast.error('Failed to start checkout process')
    } finally {
      setCreditLoading(null)
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
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
        <div className="container mx-auto px-6 pt-24 pb-8">
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
                
                {/* Action Buttons */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Manage Subscription Button */}
                    {userStats?.subscriptionTier !== 'free' && (
                      <BillingPortalButton 
                        variant="outline"
                        className="border-accent/40 text-accent hover:bg-accent/10 dark:border-accent/60 dark:text-accent dark:hover:bg-accent/20 font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Manage Subscription
                      </BillingPortalButton>
                    )}
                    
                    {/* Topup Credits Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="default"
                          className="bg-accent hover:bg-accent/90 dark:bg-gradient-to-r dark:from-accent dark:to-accent/80 dark:hover:from-accent/90 dark:hover:to-accent/70 text-white shadow-lg hover:shadow-xl font-medium transition-all duration-200 hover:scale-105"
                        >
                          <Wallet className="w-4 h-4 mr-2" />
                          Topup Credits
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        {Object.entries(STRIPE_CREDIT_PACKAGES).map(([key, pkg]) => {
                          const packageKey = key as keyof typeof STRIPE_CREDIT_PACKAGES
                          const isLoading = creditLoading === packageKey
                          
                          return (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => handleCreditPurchase(packageKey)}
                              disabled={isLoading}
                              className="flex items-center justify-between p-3 cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <div className="font-medium">{pkg.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {pkg.credits} credits • {pkg.description}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <div className="font-bold text-accent">
                                    {formatPrice(pkg.amount)}
                                  </div>
                                )}
                              </div>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 