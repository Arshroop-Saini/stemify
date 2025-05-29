"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCredits } from '@/hooks/use-credits'
import type { StemType } from '@/lib/constants'

interface CreditCalculatorProps {
  stems: StemType[]
  durationMinutes: number
  model: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft'
  className?: string
}

export function CreditCalculator({ 
  stems, 
  durationMinutes, 
  model, 
  className 
}: CreditCalculatorProps) {
  const { balance, calculateCost } = useCredits()

  const calculation = useMemo(() => {
    if (stems.length === 0 || durationMinutes <= 0) {
      return null
    }
    return calculateCost(stems, durationMinutes, model)
  }, [stems, durationMinutes, model, calculateCost])

  const hasEnoughCredits = useMemo(() => {
    if (!calculation) return false
    return balance >= calculation.totalCost
  }, [balance, calculation])

  const getModelDescription = (model: string) => {
    switch (model) {
      case 'htdemucs':
        return 'Standard 4-stem model'
      case 'htdemucs_6s':
        return '6-stem model with guitar & piano'
      case 'htdemucs_ft':
        return 'Fine-tuned model (4x slower, highest quality)'
      default:
        return model
    }
  }

  if (!calculation) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            Select stems and upload a file to see cost estimate
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading">Cost Estimate</CardTitle>
        <CardDescription>
          Credits required for this separation job
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Cost Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{durationMinutes.toFixed(3)} minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Model:</span>
            <span className="font-medium">{getModelDescription(model)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base rate:</span>
            <span className="font-medium">1 credit per minute</span>
          </div>
          {calculation.modelMultiplier > 1 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Model multiplier:</span>
              <span className="font-medium">×{calculation.modelMultiplier}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Calculation:</span>
            <span className="font-medium font-mono text-xs">
              {durationMinutes.toFixed(3)} × {calculation.modelMultiplier} = {calculation.totalCost.toFixed(3)}
            </span>
          </div>
          
          {/* Stem info - display only, doesn't affect cost */}
          <div className="border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stems selected:</span>
              <span className="font-medium">{calculation.stemCount}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ℹ️ Stem count doesn't affect cost - Demucs processes all stems simultaneously
            </div>
          </div>
        </div>

        {/* Total Cost */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Cost:</span>
            <div className="text-right">
              <div className="text-xl font-bold text-accent">
                {calculation.totalCost.toFixed(3)} credits
              </div>
              <div className="text-xs text-muted-foreground">
                ~${(calculation.totalCost * 0.025).toFixed(3)} value
              </div>
            </div>
          </div>
        </div>

        {/* Balance Check */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Your balance:</span>
            <div className="text-right">
              <div className="font-medium">{balance} credits</div>
              {hasEnoughCredits ? (
                <Badge variant="default" className="bg-green-500 text-xs">
                  Sufficient
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  Insufficient
                </Badge>
              )}
            </div>
          </div>
          
          {!hasEnoughCredits && (
            <div className="mt-2 text-xs text-destructive">
              You need {calculation.totalCost - balance} more credits
            </div>
          )}
        </div>

        {/* Stem List */}
        <div className="border-t pt-3">
          <div className="text-sm text-muted-foreground mb-2">Selected stems:</div>
          <div className="flex flex-wrap gap-1">
            {stems.map((stem) => (
              <Badge key={stem} variant="outline" className="text-xs">
                {stem}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 