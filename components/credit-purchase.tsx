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
import { ExternalLink, Loader2, Zap, CreditCard, Shield, Timer } from 'lucide-react'

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
    <Card className="overflow-hidden">
      <CardHeader className="relative bg-gradient-to-r from-surface-light to-surface-light/50 dark:from-surface-dark dark:to-surface-dark/50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-xl font-heading">
              <div className="p-2 rounded-xl bg-accent/10">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              Purchase Additional Credits
            </CardTitle>
            <CardDescription className="mt-2 font-sans">
              Get more processing power for your audio separation projects
            </CardDescription>
          </div>
          {showBalance && (
            <div className="hidden sm:block text-right">
              <div className="text-2xl font-bold font-mono text-accent">{balance.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Credits Available</div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-8">
        {/* Mobile balance display */}
        {showBalance && (
          <div className="sm:hidden text-center mb-8 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border/50">
            <div className="text-3xl font-bold font-mono text-accent">{balance.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Credits Available</div>
          </div>
        )}

        {/* Credit Packages */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {Object.entries(STRIPE_CREDIT_PACKAGES).map(([key, pkg]) => {
            const packageKey = key as keyof typeof STRIPE_CREDIT_PACKAGES
            const isLoading = loading === packageKey
            const isBestValue = key === bestValueKey
            const isPopular = key === 'medium'
            const costPerCredit = pkg.amount / pkg.credits
            
            return (
              <Card key={key} className={`relative transition-all duration-300 hover:shadow-lg group flex flex-col min-h-[420px] ${
                isBestValue 
                  ? 'ring-2 ring-accent border-accent shadow-lg shadow-accent/10 scale-105' 
                  : 'border-border hover:border-accent/30 hover:shadow-md'
              } ${isPopular ? 'md:scale-105' : ''}`}>
                {isBestValue && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-accent text-white font-medium px-4 py-1 shadow-lg">
                      Best Value
                    </Badge>
                  </div>
                )}

                {isPopular && !isBestValue && (
                  <div className="absolute -top-3 right-3">
                    <Badge className="bg-gradient-to-r from-accent to-accent/80 text-white font-medium px-3 py-1 shadow-lg">
                      Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pt-8">
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="font-heading text-xl">{pkg.name}</CardTitle>
                  </div>
                  <CardDescription className="font-sans">{pkg.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6 pb-8 flex-1 flex flex-col">
                  <div className="text-center">
                    <div className="text-4xl font-bold font-heading text-accent">{formatPrice(pkg.amount)}</div>
                    <div className="text-sm text-muted-foreground font-mono mt-1">
                      {pkg.credits} credits
                    </div>
                    <div className="inline-flex items-center px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full mt-2">
                      ${(costPerCredit / 100).toFixed(3)} per credit
                    </div>
                  </div>

                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-accent" />
                        <span className="text-muted-foreground">Processing time:</span>
                      </div>
                      <span className="font-medium font-mono">{pkg.credits} minutes</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-accent" />
                        <span className="text-muted-foreground">Credits included:</span>
                      </div>
                      <span className="font-medium font-mono">{pkg.credits}</span>
                    </div>
                  </div>

                  <Button 
                    onClick={() => handlePurchase(packageKey)}
                    disabled={!user || isLoading}
                    className={`w-full font-medium transition-all duration-200 mt-auto ${
                      isBestValue 
                        ? 'bg-accent hover:bg-accent/90 text-white shadow-lg hover:shadow-xl hover:scale-105' 
                        : ''
                    }`}
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

        {/* Benefits and Security Info */}
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center space-y-3 p-4">
            <div className="p-3 rounded-xl bg-accent/10">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-1">Secure Payment</h4>
              <p className="text-sm text-muted-foreground font-sans">Protected by Stripe encryption</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center space-y-3 p-4">
            <div className="p-3 rounded-xl bg-accent/10">
              <Timer className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-1">Never Expire</h4>
              <p className="text-sm text-muted-foreground font-sans">Use credits anytime you need</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center space-y-3 p-4">
            <div className="p-3 rounded-xl bg-accent/10">
              <CreditCard className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-1">Instant Access</h4>
              <p className="text-sm text-muted-foreground font-sans">Credits added immediately</p>
            </div>
          </div>
        </div>

        {/* Contact for Custom Packages */}
        <div className="mt-8 p-6 bg-gradient-to-br from-accent/5 to-accent/10 dark:from-accent/10 dark:to-accent/20 rounded-xl border border-accent/20 text-center">
          <h4 className="font-heading font-semibold text-accent mb-2">Need More Credits?</h4>
          <p className="text-sm text-muted-foreground font-sans">
            Contact us for custom enterprise packages and volume discounts
          </p>
        </div>
      </CardContent>
    </Card>
  )
} 