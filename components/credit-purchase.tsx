"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CREDIT_PACKAGES } from '@/lib/constants'
import { useCredits } from '@/hooks/use-credits'
import { useAuth } from '@/components/auth-provider'

interface CreditPurchaseProps {
  onPurchaseComplete?: () => void
  showBalance?: boolean
}

export function CreditPurchase({ onPurchaseComplete, showBalance = true }: CreditPurchaseProps) {
  const { user } = useAuth()
  const { balance, refreshBalance } = useCredits()
  const [loading, setLoading] = useState<string | null>(null)

  const handlePurchase = async (packageKey: keyof typeof CREDIT_PACKAGES) => {
    if (!user) return

    setLoading(packageKey)
    
    try {
      // TODO: Integrate with Stripe checkout
      // For now, just show that the purchase flow would start
      console.log(`Starting purchase for ${packageKey} package`)
      
      // Simulate purchase process
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Refresh balance after purchase
      await refreshBalance()
      onPurchaseComplete?.()
      
    } catch (error) {
      console.error('Purchase failed:', error)
    } finally {
      setLoading(null)
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatCreditsAsMinutes = (credits: number) => {
    // New pricing: 1 credit = 1 minute (base rate)
    return `${credits} min`
  }

  return (
    <div className="space-y-6">
      {showBalance && (
        <div className="text-center">
          <div className="text-2xl font-bold text-accent">{balance}</div>
          <div className="text-sm text-muted-foreground">Credits Available</div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(CREDIT_PACKAGES).map(([key, pkg]) => {
          const packageKey = key as keyof typeof CREDIT_PACKAGES
          const isLoading = loading === packageKey
          
          return (
            <Card key={key} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading">{pkg.name}</CardTitle>
                  {key === 'medium' && (
                    <Badge variant="default" className="bg-accent">
                      Popular
                    </Badge>
                  )}
                </div>
                <CardDescription>{pkg.minutes} minutes of processing</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">${pkg.price}</div>
                  <div className="text-sm text-muted-foreground">
                    {pkg.credits} credits ({pkg.minutes} minutes)
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credits:</span>
                    <span className="font-medium">{pkg.credits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing time:</span>
                    <span className="font-medium">{pkg.minutes} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost per minute:</span>
                    <span className="font-medium">
                      ${(pkg.price / pkg.minutes).toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={() => handlePurchase(packageKey)}
                  disabled={!user || isLoading}
                  className="w-full"
                  variant={key === 'medium' ? 'default' : 'outline'}
                >
                  {isLoading ? 'Processing...' : 'Purchase Credits'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Credits never expire and can be used for any audio separation job.</p>
        <p>Need more credits? Contact us for custom packages.</p>
      </div>
    </div>
  )
} 