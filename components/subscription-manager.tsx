"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import { useCredits } from '@/hooks/use-credits'
import { SUBSCRIPTION_TIERS } from '@/lib/constants'
import { Crown, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface SubscriptionManagerProps {
  currentTier: 'free' | 'creator' | 'studio'
  onTierChange?: (newTier: 'free' | 'creator' | 'studio') => void
}

export function SubscriptionManager({ currentTier, onTierChange }: SubscriptionManagerProps) {
  const { user } = useAuth()
  const { refreshBalance } = useCredits()
  const [loading, setLoading] = useState<string | null>(null)

  const handleTierChange = async (newTier: 'free' | 'creator' | 'studio') => {
    if (!user || newTier === currentTier) return

    setLoading(newTier)
    
    try {
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
        toast.success(`Subscription updated to ${newTier}`)
        await refreshBalance() // Refresh credit balance
        onTierChange?.(newTier)
      } else {
        toast.error(data.error || 'Failed to update subscription')
      }
    } catch (error) {
      console.error('Subscription change error:', error)
      toast.error('Failed to update subscription')
    } finally {
      setLoading(null)
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

  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `$${price}/month`
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
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(SUBSCRIPTION_TIERS).map(([tierKey, tier]) => {
            const isCurrentTier = tierKey === currentTier
            const isLoading = loading === tierKey
            
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
                
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-lg">
                    {getTierDisplayName(tierKey)}
                  </CardTitle>
                  <div className="text-2xl font-bold text-accent">
                    {formatPrice(tier.price)}
                  </div>
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
                    onClick={() => handleTierChange(tierKey as any)}
                    disabled={isCurrentTier || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrentTier 
                      ? 'Current Plan' 
                      : tierKey === 'free' 
                        ? 'Downgrade' 
                        : 'Upgrade'
                    }
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
      </CardContent>
    </Card>
  )
} 