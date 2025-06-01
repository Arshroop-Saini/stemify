"use client"

import { useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { redirectToCheckout } from '@/lib/stripe-client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CREDIT_PACKAGES } from '@/lib/constants'

export default function SubscriptionsPage() {
  const { user, signIn } = useAuth()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly' | 'topups'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [loadingCredit, setLoadingCredit] = useState<string | null>(null)

  // Yearly pricing calculations
  const getYearlyPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0
    // Use actual Stripe yearly pricing
    switch (monthlyPrice) {
      case 9: return 60  // Creator: $60/year (save $48)
      case 19: return 180 // Studio: $180/year (save $48)
      default: return Math.round(monthlyPrice * 12 * 0.833) // Fallback
    }
  }

  const getDisplayPrice = (monthlyPrice: number, period: 'monthly' | 'yearly' | 'topups') => {
    if (monthlyPrice === 0) return { price: 0, period: '', savings: 0 }
    
    if (period === 'monthly') {
      return { 
        price: monthlyPrice, 
        period: '/month',
        savings: 0
      }
    } else if (period === 'yearly') {
      const yearlyPrice = getYearlyPrice(monthlyPrice)
      const monthlySavings = (monthlyPrice * 12) - yearlyPrice
      return { 
        price: yearlyPrice, 
        period: '/year',
        savings: monthlySavings
      }
    } else {
      // For topups, this function won't be used, but return default values
      return { price: 0, period: '', savings: 0 }
    }
  }

  const formatPrice = (priceData: { price: number, period: string, savings: number }) => {
    if (priceData.price === 0) return '$0'
    return (
      <div className="text-center">
        <div className="text-3xl font-bold mt-4 font-mono text-foreground">
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

  const handleSubscribe = async (plan: 'creator' | 'studio') => {
    if (!user) {
      toast.error('Please sign in to subscribe')
      return
    }

    setLoading(plan)
    
    try {
      const response = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: plan,
          billingPeriod: billingPeriod,
          userId: user.id
        })
      })

      const data = await response.json()

      if (response.ok && data.sessionId) {
        // Redirect to Stripe Checkout
        await redirectToCheckout(data.sessionId)
      } else {
        throw new Error(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Subscription error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start subscription')
    } finally {
      setLoading(null)
    }
  }

  const handleCreditPurchase = async (packageKey: keyof typeof CREDIT_PACKAGES) => {
    if (!user) {
      toast.error('Please sign in to purchase credits')
      return
    }

    setLoadingCredit(packageKey)
    
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
      setLoadingCredit(null)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 pt-24 pb-8">
          {/* Header with Back Button */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="flex items-center gap-2 p-0 h-auto">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            
            <div className="text-center">
              <h1 className="text-3xl font-heading font-bold mb-4 text-foreground">Choose Your Plan</h1>
              <p className="text-gray-600 dark:text-gray-300 text-lg mb-8 font-sans">
                Start free, upgrade when you need more stems and processing time
              </p>
              
              {/* Billing Period Toggle */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex bg-surface-light dark:bg-surface-dark rounded-lg p-1">
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    className={`px-6 py-3 text-sm font-medium rounded-md transition-all ${
                      billingPeriod === 'monthly'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingPeriod('yearly')}
                    className={`px-6 py-3 text-sm font-medium rounded-md transition-all ${
                      billingPeriod === 'yearly'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Yearly
                  </button>
                  <button
                    onClick={() => setBillingPeriod('topups')}
                    className={`px-4 py-3 text-sm font-medium rounded-md transition-all ml-2 ${
                      billingPeriod === 'topups'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Top-ups
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {billingPeriod === 'topups' ? (
            // Credit packages cards
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {/* Small Package */}
              <Card className="bg-card/30 backdrop-blur-md border-2 border-white/20 dark:border-gray-700/20 hover:shadow-xl hover:bg-card/50 hover:border-white/30 dark:hover:border-gray-600/30 transition-all duration-500 ease-out hover:scale-[1.02] group">
                <CardHeader className="text-center">
                  <CardTitle className="font-heading text-lg text-foreground">{CREDIT_PACKAGES.small.name}</CardTitle>
                  <CardDescription className="font-sans text-muted-foreground">Perfect for occasional use</CardDescription>
                  <div className="text-3xl font-bold mt-4 font-mono text-foreground">${CREDIT_PACKAGES.small.price}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 font-sans">{CREDIT_PACKAGES.small.minutes} minutes of processing</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm font-sans">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      {CREDIT_PACKAGES.small.credits} credits
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      No monthly commitment
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Credits never expire
                    </li>
                  </ul>
                  <Button 
                    onClick={() => user ? handleCreditPurchase('small') : signIn()}
                    disabled={loadingCredit === 'small'}
                    variant="outline" 
                    className="w-full rounded-full border-gray-300/50 hover:border-gray-400/50 bg-card/50 hover:bg-card/70 backdrop-blur-sm font-sans transition-all duration-500 ease-out"
                  >
                    {loadingCredit === 'small' ? 'Processing...' : user ? 'Purchase Credits' : 'Sign In to Purchase'}
                  </Button>
                </CardContent>
              </Card>
              
              {/* Medium Package */}
              <Card className="bg-card/50 backdrop-blur-md border-2 border-accent/50 shadow-2xl scale-105 relative hover:bg-card/70 hover:border-accent/70 transition-all duration-500 ease-out hover:scale-[1.07] group">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-accent text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg font-sans group-hover:shadow-xl transition-shadow duration-500 ease-out">Best Value</span>
                </div>
                <CardHeader className="text-center">
                  <CardTitle className="font-heading text-lg text-foreground">{CREDIT_PACKAGES.medium.name}</CardTitle>
                  <CardDescription className="font-sans text-muted-foreground">Most popular choice</CardDescription>
                  <div className="text-3xl font-bold mt-4 font-mono text-foreground">${CREDIT_PACKAGES.medium.price}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 font-sans">{CREDIT_PACKAGES.medium.minutes} minutes of processing</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm font-sans">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      {CREDIT_PACKAGES.medium.credits} credits
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Better price per minute
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Credits never expire
                    </li>
                  </ul>
                  <Button 
                    onClick={() => user ? handleCreditPurchase('medium') : signIn()}
                    disabled={loadingCredit === 'medium'}
                    className="w-full rounded-full bg-accent hover:bg-accent/90 hover:shadow-xl shadow-lg font-sans text-white transition-all duration-500 ease-out"
                  >
                    {loadingCredit === 'medium' ? 'Processing...' : user ? 'Purchase Credits' : 'Sign In to Purchase'}
                  </Button>
                </CardContent>
              </Card>
              
              {/* Large Package */}
              <Card className="bg-card/30 backdrop-blur-md border-2 border-white/20 dark:border-gray-700/20 hover:shadow-xl hover:bg-card/50 hover:border-white/30 dark:hover:border-gray-600/30 transition-all duration-500 ease-out hover:scale-[1.02] group">
                <CardHeader className="text-center">
                  <CardTitle className="font-heading text-lg text-foreground">{CREDIT_PACKAGES.large.name}</CardTitle>
                  <CardDescription className="font-sans text-muted-foreground">For heavy users</CardDescription>
                  <div className="text-3xl font-bold mt-4 font-mono text-foreground">${CREDIT_PACKAGES.large.price}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 font-sans">{CREDIT_PACKAGES.large.minutes} minutes of processing</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm font-sans">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      {CREDIT_PACKAGES.large.credits} credits
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Best price per minute
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 text-accent mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      Credits never expire
                    </li>
                  </ul>
                  <Button 
                    onClick={() => user ? handleCreditPurchase('large') : signIn()}
                    disabled={loadingCredit === 'large'}
                    variant="outline" 
                    className="w-full rounded-full border-gray-300/50 hover:border-gray-400/50 bg-card/50 hover:bg-card/70 backdrop-blur-sm font-sans transition-all duration-500 ease-out"
                  >
                    {loadingCredit === 'large' ? 'Processing...' : user ? 'Purchase Credits' : 'Sign In to Purchase'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Subscription plan cards
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
                  <Button variant="outline" className="w-full rounded-full border-gray-300/50 hover:border-gray-400/50 bg-card/50 hover:bg-card/70 backdrop-blur-sm font-sans transition-all duration-500 ease-out" disabled>
                    Current Plan
                  </Button>
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
                  {formatPrice(getDisplayPrice(9, billingPeriod))}
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
                  <Button 
                    onClick={() => user ? handleSubscribe('creator') : signIn()}
                    disabled={loading === 'creator'}
                    className="w-full rounded-full bg-accent hover:bg-accent/90 hover:shadow-xl shadow-lg font-sans text-white transition-all duration-500 ease-out"
                  >
                    {loading === 'creator' ? 'Processing...' : user ? 'Subscribe to Creator' : 'Sign In to Subscribe'}
                  </Button>
                </CardContent>
              </Card>
              
              {/* Studio Plan */}
              <Card className="bg-card/30 backdrop-blur-md border-2 border-white/20 dark:border-gray-700/20 hover:shadow-xl hover:bg-card/50 hover:border-white/30 dark:hover:border-gray-600/30 transition-all duration-500 ease-out hover:scale-[1.02] group">
                {billingPeriod === 'yearly' && (
                  <div className="absolute -top-3 right-3">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">Best Value</span>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="font-heading text-lg text-foreground">Studio</CardTitle>
                  <CardDescription className="font-sans text-muted-foreground">High volume processing</CardDescription>
                  {formatPrice(getDisplayPrice(19, billingPeriod))}
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
                  <Button 
                    onClick={() => user ? handleSubscribe('studio') : signIn()}
                    disabled={loading === 'studio'}
                    variant="outline" 
                    className="w-full rounded-full border-gray-300/50 hover:border-gray-400/50 bg-card/50 hover:bg-card/70 backdrop-blur-sm font-sans transition-all duration-500 ease-out"
                  >
                    {loading === 'studio' ? 'Processing...' : user ? 'Subscribe to Studio' : 'Sign In to Subscribe'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
} 