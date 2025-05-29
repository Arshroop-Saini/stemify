"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { 
  getUserCreditBalance, 
  calculateCreditsRequired, 
  validateUserOperation,
  checkCreditBalance,
  type CreditOperation,
  type CreditCalculation 
} from '@/lib/credits'
import type { StemType } from '@/lib/constants'

export interface UseCreditsReturn {
  balance: number
  totalCredits: number
  loading: boolean
  error: string | null
  refreshBalance: () => Promise<void>
  calculateCost: (stems: StemType[], durationMinutes: number, model?: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft') => CreditCalculation
  validateOperation: (operation: {
    stems: StemType[]
    durationMinutes: number
    model: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft'
  }) => Promise<CreditOperation & { tier?: string }>
  checkBalance: (requiredCredits: number) => Promise<CreditOperation>
}

export function useCredits(): UseCreditsReturn {
  const { user } = useAuth()
  const [balance, setBalance] = useState<number>(0)
  const [totalCredits, setTotalCredits] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch user's credit balance
  const refreshBalance = useCallback(async () => {
    if (!user?.id) {
      setBalance(0)
      setTotalCredits(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const creditData = await getUserCreditBalance(user.id)
      setBalance(creditData.remaining)
      setTotalCredits(creditData.total)
    } catch (err) {
      setError('Failed to fetch credit balance')
      console.error('Error fetching credit balance:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Load balance on mount and when user changes
  useEffect(() => {
    refreshBalance()
  }, [refreshBalance])

  // Calculate cost for a separation operation
  const calculateCost = useCallback((
    stems: StemType[], 
    durationMinutes: number, 
    model: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft' = 'htdemucs'
  ): CreditCalculation => {
    return calculateCreditsRequired(stems, durationMinutes, model)
  }, [])

  // Validate if user can perform an operation
  const validateOperation = useCallback(async (operation: {
    stems: StemType[]
    durationMinutes: number
    model: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft'
  }): Promise<CreditOperation & { tier?: string }> => {
    if (!user?.id) {
      return {
        success: false,
        message: 'User not authenticated'
      }
    }

    try {
      const result = await validateUserOperation(user.id, operation)
      return result
    } catch (err) {
      return {
        success: false,
        message: 'Error validating operation'
      }
    }
  }, [user?.id])

  // Check if user has sufficient credits
  const checkBalance = useCallback(async (requiredCredits: number): Promise<CreditOperation> => {
    if (!user?.id) {
      return {
        success: false,
        message: 'User not authenticated'
      }
    }

    try {
      const result = await checkCreditBalance(user.id, requiredCredits)
      return result
    } catch (err) {
      return {
        success: false,
        message: 'Error checking credit balance'
      }
    }
  }, [user?.id])

  return {
    balance,
    totalCredits,
    loading,
    error,
    refreshBalance,
    calculateCost,
    validateOperation,
    checkBalance
  }
} 