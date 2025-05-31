// Credit Management System for Stemify

import { createClient } from './supabase'
import { SUBSCRIPTION_TIERS, STEM_COSTS } from './constants'
import type { StemType } from './constants'

export interface CreditOperation {
  success: boolean
  message: string
  creditsRemaining?: number
  creditsRequired?: number
}

export interface CreditCalculation {
  baseCost: number
  modelMultiplier: number
  totalCost: number
  stemCount: number
}

/**
 * Calculate credits required for a separation job
 * Formula: credits = exact_duration_minutes × model_multiplier
 * Note: Stem count is irrelevant - Demucs processes all stems simultaneously
 */
export function calculateCreditsRequired(
  stems: StemType[], // Keep for validation but don't use in calculation
  durationMinutes: number,
  model: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft' = 'htdemucs'
): CreditCalculation {
  // Use precise decimal duration (no rounding)
  const exactDuration = Number(durationMinutes.toFixed(6)) // 6 decimal precision
  
  // Base cost is 1.0 credit per minute (corrected from 2.0)
  const baseCostPerMinute = 1.0
  
  // Get model multiplier
  const modelMultiplier = STEM_COSTS.modelMultipliers[model] || 1
  
  // Calculate total cost: 1.0 credit/min × duration × model multiplier
  const totalCost = Number((baseCostPerMinute * exactDuration * modelMultiplier).toFixed(6))
  
  return {
    baseCost: baseCostPerMinute, // Base cost per minute
    modelMultiplier,
    totalCost,
    stemCount: stems.length // For display purposes only, not used in calculation
  }
}

/**
 * Check if user has sufficient credits for an operation
 */
export async function checkCreditBalance(
  userId: string,
  requiredCredits: number
): Promise<CreditOperation> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .rpc('get_user_credit_balance', { user_id: userId })

    if (error) {
      return {
        success: false,
        message: 'Failed to check credit balance',
      }
    }

    const currentBalance = data || 0

    if (currentBalance < requiredCredits) {
      return {
        success: false,
        message: `Insufficient credits. You need ${requiredCredits} credits but only have ${currentBalance}.`,
        creditsRemaining: currentBalance,
        creditsRequired: requiredCredits
      }
    }

    return {
      success: true,
      message: 'Sufficient credits available',
      creditsRemaining: currentBalance,
      creditsRequired: requiredCredits
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error checking credit balance',
    }
  }
}

/**
 * Deduct credits for a separation job
 */
export async function deductCredits(
  userId: string,
  credits: number,
  jobId: string,
  description: string = 'Audio separation job',
  supabaseClient?: any // Optional authenticated client
): Promise<CreditOperation> {
  const supabase = supabaseClient || createClient()

  try {
    const { data, error } = await supabase
      .rpc('deduct_credits', {
        user_id: userId,
        credits_amount: credits,
        job_id: jobId,
        description
      })

    if (error) {
      console.error('Credit deduction RPC error details:', error)
      return {
        success: false,
        message: `Failed to deduct credits: ${error.message || 'Unknown error'}`,
      }
    }

    return {
      success: true,
      message: `Successfully deducted ${credits} credits`,
      creditsRemaining: data
    }
  } catch (error) {
    console.error('Credit deduction caught exception:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return {
      success: false,
      message: `Error deducting credits: ${errorMessage}`,
    }
  }
}

/**
 * Add credits to user account (for purchases)
 */
export async function addCredits(
  userId: string,
  credits: number,
  paymentId?: string,
  description: string = 'Credit purchase'
): Promise<CreditOperation> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .rpc('add_credits_with_total', {
        user_id: userId,
        credits_amount: credits,
        payment_id: paymentId,
        description
      })

    if (error) {
      return {
        success: false,
        message: 'Failed to add credits',
      }
    }

    return {
      success: true,
      message: `Successfully added ${credits} credits`,
      creditsRemaining: data
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error adding credits',
    }
  }
}

/**
 * Get user's current credit balance and total credits
 */
export async function getUserCreditBalance(userId: string): Promise<{remaining: number, total: number}> {
  const supabase = createClient()

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('credits_remaining, total_credits')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error getting credit balance:', error)
      return { remaining: 0, total: 0 }
    }

    return { 
      remaining: user?.credits_remaining || 0,
      total: user?.total_credits || 0
    }
  } catch (error) {
    console.error('Error getting credit balance:', error)
    return { remaining: 0, total: 0 }
  }
}

/**
 * Check if user can perform operation based on subscription tier
 */
export async function validateUserOperation(
  userId: string,
  operation: {
    stems: StemType[]
    durationMinutes: number
    model: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft'
    fileSize?: number
  },
  supabaseClient?: any // Optional authenticated client
): Promise<CreditOperation & { tier?: string }> {
  const supabase = supabaseClient || createClient()

  console.log('validateUserOperation called with:', {
    userId,
    operation: {
      stems: operation.stems,
      durationMinutes: operation.durationMinutes,
      model: operation.model,
      fileSize: operation.fileSize
    },
    hasAuthenticatedClient: !!supabaseClient
  })

  try {
    // Get user's subscription tier and current usage
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_tier, credits_remaining')
      .eq('id', userId)
      .single()

    console.log('User data retrieved:', { user, error })

    if (error || !user) {
      console.error('User lookup failed:', error)
      return {
        success: false,
        message: 'User not found. Please ensure you have an active account.',
        tier: 'free'
      }
    }

    const userTier = user.subscription_tier || 'free'
    const creditsRemaining = user.credits_remaining || 0

    console.log('User tier and credits:', { userTier, creditsRemaining })

    const tier = SUBSCRIPTION_TIERS[userTier as keyof typeof SUBSCRIPTION_TIERS]
    console.log('Tier configuration:', tier)
    
    const calculation = calculateCreditsRequired(
      operation.stems,
      operation.durationMinutes,
      operation.model
    )

    console.log('Credit calculation result:', calculation)

    // Check tier-specific limitations
    if (userTier === 'free') {
      console.log('Checking free tier limitations...')
      
      // Free tier: only 4 stems (vocals, drums, bass, other)
      if (operation.stems.length > 4) {
        console.log('Free tier stem count exceeded:', operation.stems.length)
        return {
          success: false,
          message: 'Free tier is limited to 4 stems. Upgrade to Creator or Studio for 6 stems.',
          tier: userTier
        }
      }

      // Free tier: only standard model
      if (operation.model === 'htdemucs_ft') {
        console.log('Free tier trying to use fine-tuned model')
        return {
          success: false,
          message: 'Fine-tuned model is available for Creator and Studio plans only.',
          tier: userTier
        }
      }

      // Check if stems are allowed for free tier
      const allowedStems = tier.availableStems
      console.log('Free tier allowed stems:', allowedStems)
      console.log('Requested stems:', operation.stems)
      
      const invalidStems = operation.stems.filter(stem => !allowedStems.includes(stem as any))
      console.log('Invalid stems for free tier:', invalidStems)
      
      if (invalidStems.length > 0) {
        console.log('Free tier stem validation failed')
        return {
          success: false,
          message: `Stems ${invalidStems.join(', ')} are not available on free tier. Upgrade to access all stems.`,
          tier: userTier
        }
      }
    } else {
      console.log('User is on paid tier, skipping free tier limitations')
    }

    // Check credit balance
    console.log('Checking credit balance:', {
      creditsRemaining,
      requiredCredits: calculation.totalCost
    })
    
    if (creditsRemaining < calculation.totalCost) {
      console.log('Insufficient credits')
      return {
        success: false,
        message: `Insufficient credits. You need ${calculation.totalCost.toFixed(1)} credits but only have ${creditsRemaining.toFixed(1)}.`,
        creditsRemaining,
        creditsRequired: calculation.totalCost,
        tier: userTier
      }
    }

    console.log('All validations passed')
    return {
      success: true,
      message: 'Operation validated successfully',
      creditsRemaining,
      creditsRequired: calculation.totalCost,
      tier: userTier
    }

  } catch (error) {
    console.error('Error in validateUserOperation:', error)
    return {
      success: false,
      message: 'Validation failed. Please try again.',
      tier: 'free'
    }
  }
}

/**
 * Get credit packages for purchase
 */
export const CREDIT_PACKAGES = {
  small: {
    credits: 30, // 30 minutes = 30 credits (1:1 ratio)
    price: 500, // $5.00 (500 cents)
    name: 'Small Pack',
    description: '30 minutes of processing'
  },
  medium: {
    credits: 120, // 120 minutes = 120 credits (1:1 ratio)
    price: 1500, // $15.00 (1500 cents)
    name: 'Medium Pack',
    description: '120 minutes of processing'
  },
  large: {
    credits: 500, // 500 minutes = 500 credits (1:1 ratio)
    price: 4000, // $40.00 (4000 cents)
    name: 'Large Pack',
    description: '500 minutes of processing'
  }
} as const

export type CreditPackage = keyof typeof CREDIT_PACKAGES 

/**
 * Get monthly credit allocation based on subscription tier
 */
export function getMonthlyCreditsForTier(tier: 'free' | 'creator' | 'studio'): number {
  const tierConfig = SUBSCRIPTION_TIERS[tier]
  return tierConfig.monthlyMinutes // 1:1 ratio: 1 credit = 1 minute
}

/**
 * Initialize or refresh user credits based on subscription tier
 * Called on signup and subscription changes
 */
export async function initializeUserCredits(
  userId: string,
  subscriptionTier: 'free' | 'creator' | 'studio' = 'free'
): Promise<CreditOperation> {
  const supabase = createClient()

  try {
    const monthlyCredits = getMonthlyCreditsForTier(subscriptionTier)
    
    // Update user with correct credit allocation
    const { error } = await supabase
      .from('users')
      .update({
        total_credits: monthlyCredits,
        credits_remaining: monthlyCredits,
        subscription_tier: subscriptionTier
      })
      .eq('id', userId)

    if (error) {
      console.error('Error initializing user credits:', error)
      return {
        success: false,
        message: 'Failed to initialize credits'
      }
    }

    return {
      success: true,
      message: `Credits initialized for ${subscriptionTier} tier`,
      creditsRemaining: monthlyCredits
    }
  } catch (error) {
    console.error('Error in initializeUserCredits:', error)
    return {
      success: false,
      message: 'Error initializing credits'
    }
  }
}

/**
 * Refresh monthly credits for subscription renewal
 */
export async function refreshMonthlyCredits(
  userId: string,
  subscriptionTier: 'free' | 'creator' | 'studio'
): Promise<CreditOperation> {
  const supabase = createClient()
  return refreshMonthlyCreditsWithClient(supabase, userId, subscriptionTier)
}

/**
 * Refresh monthly credits for subscription renewal (webhook-compatible)
 * @param supabaseClient - Pass service role client for webhooks, regular client for user operations
 */
export async function refreshMonthlyCreditsWithClient(
  supabaseClient: any,
  userId: string,
  subscriptionTier: 'free' | 'creator' | 'studio'
): Promise<CreditOperation> {
  try {
    const monthlyCredits = getMonthlyCreditsForTier(subscriptionTier)
    
    // Add new monthly credits (don't reset total_credits)
    const { data, error } = await supabaseClient
      .rpc('add_credits_with_total', {
        user_id: userId,
        credits_amount: monthlyCredits,
        payment_id: null,
        description: `Monthly ${subscriptionTier} subscription credits`
      })

    if (error) {
      console.error('RPC error in refreshMonthlyCreditsWithClient:', error)
      return {
        success: false,
        message: 'Failed to refresh monthly credits'
      }
    }

    return {
      success: true,
      message: `Monthly credits refreshed for ${subscriptionTier} tier`,
      creditsRemaining: data
    }
  } catch (error) {
    console.error('Error in refreshMonthlyCreditsWithClient:', error)
    return {
      success: false,
      message: 'Error refreshing monthly credits'
    }
  }
}

/**
 * Update user subscription tier and adjust credits
 */
export async function updateUserSubscription(
  userId: string,
  newTier: 'free' | 'creator' | 'studio'
): Promise<CreditOperation> {
  const supabase = createClient()
  return updateUserSubscriptionWithClient(supabase, userId, newTier)
}

/**
 * Update user subscription tier and adjust credits (webhook-compatible)
 * @param supabaseClient - Pass service role client for webhooks, regular client for user operations
 */
export async function updateUserSubscriptionWithClient(
  supabaseClient: any,
  userId: string,
  newTier: 'free' | 'creator' | 'studio'
): Promise<CreditOperation> {
  try {
    // Get current user data
    const { data: currentUser, error: fetchError } = await supabaseClient
      .from('users')
      .select('subscription_tier, credits_remaining')
      .eq('id', userId)
      .single()

    if (fetchError || !currentUser) {
      console.error('Failed to fetch user in updateUserSubscriptionWithClient:', fetchError)
      return {
        success: false,
        message: 'Failed to fetch current user data'
      }
    }

    const newMonthlyCredits = getMonthlyCreditsForTier(newTier)
    const oldTierCredits = getMonthlyCreditsForTier(currentUser.subscription_tier as any)
    
    // Calculate credit adjustment
    const creditDifference = newMonthlyCredits - oldTierCredits
    const newCreditsRemaining = Math.max(0, currentUser.credits_remaining + creditDifference)

    // Update subscription tier and adjust credits
    const { error } = await supabaseClient
      .from('users')
      .update({
        subscription_tier: newTier,
        total_credits: newMonthlyCredits,
        credits_remaining: newCreditsRemaining
      })
      .eq('id', userId)

    if (error) {
      console.error('Failed to update user subscription in database:', error)
      return {
        success: false,
        message: 'Failed to update subscription'
      }
    }

    // Log the subscription change
    if (creditDifference !== 0) {
      const { error: logError } = await supabaseClient
        .from('credits')
        .insert({
          user_id: userId,
          amount: creditDifference,
          transaction_type: 'subscription',
          description: `Subscription upgraded from ${currentUser.subscription_tier} to ${newTier}`,
          separation_job_id: null,
          payment_id: null
        })

      if (logError) {
        console.error('Failed to log subscription change:', logError)
        // Don't fail the operation for logging errors
      }
    }

    return {
      success: true,
      message: `Subscription updated to ${newTier}`,
      creditsRemaining: newCreditsRemaining
    }
  } catch (error) {
    console.error('Error in updateUserSubscriptionWithClient:', error)
    return {
      success: false,
      message: 'Error updating subscription'
    }
  }
}

/**
 * Fix existing users with incorrect credit allocation (1000 credits)
 * This should be called to migrate existing users to proper tier-based credits
 */
export async function fixExistingUserCredits(): Promise<{ fixed: number, errors: number }> {
  const supabase = createClient()
  let fixed = 0
  let errors = 0

  try {
    // Get all users with 1000 total_credits (the incorrect default)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, subscription_tier, total_credits, credits_remaining')
      .eq('total_credits', 1000)

    if (error) {
      console.error('Error fetching users to fix:', error)
      return { fixed: 0, errors: 1 }
    }

    if (!users || users.length === 0) {
      console.log('No users found with incorrect credit allocation')
      return { fixed: 0, errors: 0 }
    }

    console.log(`Found ${users.length} users with incorrect credit allocation`)

    // Fix each user
    for (const user of users) {
      try {
        const correctCredits = getMonthlyCreditsForTier(user.subscription_tier as any)
        
        // Calculate how many credits the user has actually used
        const creditsUsed = 1000 - user.credits_remaining
        const newCreditsRemaining = Math.max(0, correctCredits - creditsUsed)

        await supabase
          .from('users')
          .update({
            total_credits: correctCredits,
            credits_remaining: newCreditsRemaining
          })
          .eq('id', user.id)

        console.log(`Fixed user ${user.id}: ${user.subscription_tier} tier should have ${correctCredits} credits, now has ${newCreditsRemaining} remaining`)
        fixed++
      } catch (err) {
        console.error(`Error fixing user ${user.id}:`, err)
        errors++
      }
    }

    return { fixed, errors }
  } catch (error) {
    console.error('Error in fixExistingUserCredits:', error)
    return { fixed: 0, errors: 1 }
  }
} 