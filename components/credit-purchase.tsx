"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { STRIPE_CREDIT_PACKAGES } from '@/lib/stripe-config'
import { redirectToCheckout } from '@/lib/stripe-client'
import { useCredits } from '@/hooks/use-credits'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { ExternalLink, Loader2 } from 'lucide-react'

interface CreditPurchaseProps {
  onPurchaseComplete?: () => void
  showBalance?: boolean
}

export function CreditPurchase({ onPurchaseComplete, showBalance = true }: CreditPurchaseProps) {
  const { user } = useAuth()
  const { balance, refreshBalance } = useCredits()
  const [loading, setLoading] = useState<string | null>(null)

  const handlePurchase = async (packageKey: keyof typeof STRIPE_CREDIT_PACKAGES) => {
    if (!user) {
      toast.error('Please sign in to purchase credits')
      return
    }

    setLoading(packageKey)
    
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
      setLoading(null)
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const getBestValuePackage = () => {
    const packages = Object.entries(STRIPE_CREDIT_PACKAGES)
    const bestValue = packages.reduce((best, [key, pkg]) => {
      const costPerCredit = pkg.amount / pkg.credits
      const bestCostPerCredit = best.pkg.amount / best.pkg.credits
      return costPerCredit < bestCostPerCredit ? { key, pkg } : best
    }, { key: packages[0][0], pkg: packages[0][1] })
    
    return bestValue.key
  }

  const bestValueKey = getBestValuePackage()

  return (
    <div className="space-y-6">
      {showBalance && (
        <div className="text-center">
          <div className="text-2xl font-bold text-accent">{balance.toFixed(1)}</div>
          <div className="text-sm text-muted-foreground">Credits Available</div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(STRIPE_CREDIT_PACKAGES).map(([key, pkg]) => {
          const packageKey = key as keyof typeof STRIPE_CREDIT_PACKAGES
          const isLoading = loading === packageKey
          const isBestValue = key === bestValueKey
          const costPerCredit = pkg.amount / pkg.credits
          
          return (
            <Card key={key} className={`relative transition-all duration-200 ${
              isBestValue 
                ? 'ring-2 ring-accent border-accent scale-105' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              {isBestValue && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-accent text-white">
                    Best Value
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading">{pkg.name}</CardTitle>
                  {key === 'medium' && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Popular
                    </Badge>
                  )}
                </div>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{formatPrice(pkg.amount)}</div>
                  <div className="text-sm text-muted-foreground">
                    {pkg.credits} credits
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credits:</span>
                    <span className="font-medium">{pkg.credits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing time:</span>
                    <span className="font-medium">{pkg.credits} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost per minute:</span>
                    <span className="font-medium">
                      ${(costPerCredit / 100).toFixed(3)}
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={() => handlePurchase(packageKey)}
                  disabled={!user || isLoading}
                  className={`w-full ${isBestValue ? 'bg-accent hover:bg-accent/90' : ''}`}
                  variant={isBestValue ? 'default' : 'outline'}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Purchase Credits
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>💳 Secure payment processing by Stripe</p>
        <p>⏰ Credits never expire and can be used for any audio separation job</p>
        <p>📧 Need more credits? Contact us for custom packages</p>
      </div>
    </div>
  )
} 