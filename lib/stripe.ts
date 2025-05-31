import Stripe from 'stripe'
import { STRIPE_CREDIT_PACKAGES as BASE_CREDIT_PACKAGES, STRIPE_SUBSCRIPTION_PRICES as BASE_SUBSCRIPTION_PRICES, STRIPE_CONFIG } from './stripe-config'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required')
}

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
  typescript: true,
})

// Server-side credit packages with real price IDs from environment
export const STRIPE_CREDIT_PACKAGES = {
  small: {
    ...BASE_CREDIT_PACKAGES.small,
    priceId: process.env.STRIPE_CREDITS_SMALL_PRICE_ID || 'price_placeholder_small'
  },
  medium: {
    ...BASE_CREDIT_PACKAGES.medium,
    priceId: process.env.STRIPE_CREDITS_MEDIUM_PRICE_ID || 'price_placeholder_medium'
  },
  large: {
    ...BASE_CREDIT_PACKAGES.large,
    priceId: process.env.STRIPE_CREDITS_LARGE_PRICE_ID || 'price_placeholder_large'
  }
} as const

// Server-side subscription prices with real price IDs from environment
export const STRIPE_SUBSCRIPTION_PRICES = {
  creator_monthly: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID || 'price_placeholder_creator_monthly',
  creator_yearly: process.env.STRIPE_CREATOR_YEARLY_PRICE_ID || 'price_placeholder_creator_yearly',
  studio_monthly: process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID || 'price_placeholder_studio_monthly',
  studio_yearly: process.env.STRIPE_STUDIO_YEARLY_PRICE_ID || 'price_placeholder_studio_yearly'
} as const

// Re-export config
export { STRIPE_CONFIG }

// Stripe configuration constants
export const STRIPE_PRODUCTS = {
  creator: {
    monthly: {
      priceId: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID || 'price_creator_monthly',
      name: 'Creator Plan - Monthly',
      amount: 900, // $9.00 in cents
      interval: 'month' as const,
      features: ['60 minutes/month', '6 stems', 'WAV + MP3 output', 'Fine-tuned model']
    },
    yearly: {
      priceId: process.env.STRIPE_CREATOR_YEARLY_PRICE_ID || 'price_creator_yearly',
      name: 'Creator Plan - Yearly',
      amount: 6000, // $60.00 in cents (save $48/year)
      interval: 'year' as const,
      features: ['60 minutes/month', '6 stems', 'WAV + MP3 output', 'Fine-tuned model', 'Save $48/year!']
    }
  },
  studio: {
    monthly: {
      priceId: process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID || 'price_studio_monthly', 
      name: 'Studio Plan - Monthly',
      amount: 1900, // $19.00 in cents
      interval: 'month' as const,
      features: ['200 minutes/month', '6 stems', 'WAV + MP3 output', 'Fine-tuned model']
    },
    yearly: {
      priceId: process.env.STRIPE_STUDIO_YEARLY_PRICE_ID || 'price_studio_yearly',
      name: 'Studio Plan - Yearly', 
      amount: 18000, // $180.00 in cents (save $48/year)
      interval: 'year' as const,
      features: ['200 minutes/month', '6 stems', 'WAV + MP3 output', 'Fine-tuned model', 'Save $48/year!']
    }
  }
} as const

// Helper function to format amount for display
export function formatStripeAmount(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`
}

// Helper function to get product configuration by tier and billing interval
export function getStripeProductByTier(tier: 'creator' | 'studio', interval: 'monthly' | 'yearly' = 'monthly') {
  const tierProducts = STRIPE_PRODUCTS[tier]
  if (!tierProducts) {
    throw new Error(`Invalid subscription tier: ${tier}`)
  }
  
  const product = tierProducts[interval]
  if (!product) {
    throw new Error(`Invalid billing interval: ${interval} for tier: ${tier}`)
  }
  
  return product
}

// Helper function to get credit package with server-side validation
export function getStripeCreditPackage(packageKey: keyof typeof STRIPE_CREDIT_PACKAGES) {
  const pkg = STRIPE_CREDIT_PACKAGES[packageKey]
  if (!pkg) {
    throw new Error(`Invalid credit package key: ${packageKey}`)
  }
  return pkg
}

// Helper function to get subscription price ID
export function getStripeSubscriptionPrice(tier: 'creator' | 'studio', period: 'monthly' | 'yearly') {
  const priceKey = `${tier}_${period}` as keyof typeof STRIPE_SUBSCRIPTION_PRICES
  const priceId = STRIPE_SUBSCRIPTION_PRICES[priceKey]
  if (!priceId) {
    throw new Error(`Invalid subscription configuration: ${tier} ${period}`)
  }
  return priceId
} 
 