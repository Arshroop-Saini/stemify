"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import { useCredits } from '@/hooks/use-credits'
import { SUBSCRIPTION_TIERS } from '@/lib/constants'
import { redirectToCheckout } from '@/lib/stripe-client'
import { BillingPortalButton } from '@/components/billing-portal-button'
import { Crown, Check, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface SubscriptionManagerProps {
  currentTier: 'free' | 'creator' | 'studio'
  onTierChange?: (newTier: 'free' | 'creator' | 'studio') => void
}

export function SubscriptionManager({ currentTier, onTierChange }: SubscriptionManagerProps) {
  const { user } = useAuth()
  const { refreshBalance } = useCredits()
  const [loading, setLoading] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')

  // Yearly pricing with discounts
  const getYearlyPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0
    // Use actual Stripe yearly pricing
    switch (monthlyPrice) {
      case 9: return 60  // Creator: $60/year (save $48)
      case 19: return 180 // Studio: $180/year (save $48)
      default: return Math.round(monthlyPrice * 12 * 0.833) // Fallback
    }
  }

  const getDisplayPrice = (tier: any, period: 'monthly' | 'yearly') => {
    if (tier.price === 0) return { price: 0, period: '', savings: 0 }
    
    if (period === 'monthly') {
      return { 
        price: tier.price, 
        period: '/month',
        savings: 0
      }
    } else {
      const yearlyPrice = getYearlyPrice(tier.price)
      const monthlySavings = (tier.price * 12) - yearlyPrice
      return { 
        price: yearlyPrice, 
        period: '/year',
        savings: monthlySavings
      }
    }
  }

  const handleUpgrade = async (newTier: 'creator' | 'studio') => {
    if (!user) {
      toast.error('Please sign in to upgrade')
      return
    }

    setLoading(newTier)
    
    try {
      const response = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: newTier,
          userId: user.id,
          billingPeriod // Pass the selected billing period
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
      console.error('Stripe checkout error:', error)
      toast.error('Failed to start checkout process')
    } finally {
      setLoading(null)
    }
  }

  const handleDowngrade = async (newTier: 'free') => {
    if (!user) return

    setLoading(newTier)
    
    try {
      // Use existing API for downgrades (free tier)
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'change',
          tier: newTier,
          userId: user.id
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Downgraded to ${newTier} plan`)
        await refreshBalance() // Refresh credit balance
        onTierChange?.(newTier)
      } else {
        toast.error(data.error || 'Failed to downgrade subscription')
      }
    } catch (error) {
      console.error('Subscription downgrade error:', error)
      toast.error('Failed to downgrade subscription')
    } finally {
      setLoading(null)
    }
  }

  const handleTierAction = (tierKey: string) => {
    if (tierKey === currentTier) return

    if (tierKey === 'free') {
      handleDowngrade('free')
    } else {
      handleUpgrade(tierKey as 'creator' | 'studio')
    }
  }

  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'creator': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'studio': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatPrice = (priceData: { price: number, period: string, savings: number }) => {
    if (priceData.price === 0) return 'Free'
    return (
      <div className="text-center">
        <div className="text-2xl font-bold text-accent">
          ${priceData.price}{priceData.period}
        </div>
        {priceData.savings > 0 && (
          <div className="text-xs text-green-600 font-medium mt-1">
            Save ${priceData.savings}/year
          </div>
        )}
      </div>
    )
  }

  const getActionLabel = (tierKey: string, isCurrentTier: boolean, isLoading: boolean) => {
    if (isLoading) return <Loader2 className="w-4 h-4 animate-spin mr-2" />
    if (isCurrentTier) return 'Current Plan'
    if (tierKey === 'free') return 'Downgrade'
    return (
      <span className="flex items-center gap-1">
        Upgrade <ExternalLink className="w-3 h-3" />
      </span>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" />
          Subscription Management
        </CardTitle>
        <CardDescription>
          Manage your subscription tier and credit allocation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all relative ${
                billingPeriod === 'yearly'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Yearly
              <Badge 
                variant="secondary" 
                className="absolute -top-1 -right-1 bg-green-100 text-green-700 text-xs px-1 py-0"
              >
                Save $48
              </Badge>
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(SUBSCRIPTION_TIERS).map(([tierKey, tier]) => {
            const isCurrentTier = tierKey === currentTier
            const isLoading = loading === tierKey
            const priceData = getDisplayPrice(tier, billingPeriod)
            
            return (
              <Card 
                key={tierKey} 
                className={`relative transition-all duration-200 ${
                  isCurrentTier 
                    ? 'ring-2 ring-accent border-accent' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {isCurrentTier && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-accent text-white">
                      Current Plan
                    </Badge>
                  </div>
                )}

                {tierKey === 'creator' && billingPeriod === 'yearly' && (
                  <div className="absolute -top-2 right-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-lg">
                    {getTierDisplayName(tierKey)}
                  </CardTitle>
                  {formatPrice(priceData)}
                  <CardDescription>
                    {tier.monthlyMinutes} minutes/month
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <ul className="space-y-2 text-sm mb-4">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-accent flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    variant={isCurrentTier ? "outline" : "default"}
                    className="w-full"
                    onClick={() => handleTierAction(tierKey)}
                    disabled={isCurrentTier || isLoading}
                  >
                    {getActionLabel(tierKey, isCurrentTier, isLoading)}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium mb-2">How Credits Work</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• 1 credit = 1 minute of audio processing</li>
            <li>• Credits refresh monthly based on your subscription</li>
            <li>• Unused credits expire at the end of each month</li>
            <li>• You can also purchase additional credits as needed</li>
          </ul>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="mb-1">
                💡 <strong>Upgrades:</strong> Redirects to secure Stripe checkout
              </p>
              {currentTier !== 'free' && (
                <p>
                  💡 <strong>Manage billing:</strong> Cancel, change plans, update payment methods
                </p>
              )}
            </div>
            {currentTier !== 'free' && (
              <BillingPortalButton 
                variant="outline" 
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-800/50"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 