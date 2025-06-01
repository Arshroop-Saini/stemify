"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/components/auth-provider'
import { Crown, Coins } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { CreditPurchase } from '@/components/credit-purchase'

interface SubscriptionManagerProps {
  currentTier: 'free' | 'creator' | 'studio'
  onPurchaseComplete?: () => void
}

export function SubscriptionManager({ currentTier, onPurchaseComplete }: SubscriptionManagerProps) {
  const { user } = useAuth()

  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="relative bg-gradient-to-r from-surface-light to-surface-light/50 dark:from-surface-dark dark:to-surface-dark/50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-xl font-heading">
              <div className="p-2 rounded-xl bg-accent/10">
                <Crown className="w-6 h-6 text-accent" />
              </div>
              Subscription Management
            </CardTitle>
            <CardDescription className="mt-2 font-sans">
              Manage your credits and learn how the system works
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {/* How Credits Work - Collapsible */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border/50 hover:bg-surface-light/80 dark:hover:bg-surface-dark/80 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <span className="text-accent font-bold">💡</span>
              </div>
              <h4 className="font-heading font-semibold">How Credits Work</h4>
            </div>
            <ChevronDown className="w-4 h-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border/50">
              <ul className="text-sm text-muted-foreground space-y-2 font-sans">
                <li className="flex items-start gap-2">
                  <span className="text-accent">•</span>
                  <span>1 credit = 1 minute of audio processing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">•</span>
                  <span>Credits refresh monthly based on your subscription</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">•</span>
                  <span>Unused credits expire at the end of each month</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent">•</span>
                  <span>You can also purchase additional credits as needed</span>
                </li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Purchase Additional Credits - Collapsible */}
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border/50 hover:bg-surface-light/80 dark:hover:bg-surface-dark/80 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Coins className="w-4 h-4 text-accent" />
              </div>
              <h4 className="font-heading font-semibold">Purchase Additional Credits</h4>
            </div>
            <ChevronDown className="w-4 h-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <CreditPurchase onPurchaseComplete={onPurchaseComplete} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}