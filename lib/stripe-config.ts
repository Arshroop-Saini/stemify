// Stripe Configuration Constants
// Safe for both server and client-side imports

// Note: Price IDs will be fetched from server-side API calls rather than exposed to client
export const STRIPE_CREDIT_PACKAGES = {
  small: {
    credits: 30,
    amount: 500, // $5.00 in cents
    name: 'Small Pack',
    description: '30 minutes of processing',
    priceId: 'price_placeholder_small' // Will be replaced by server-side logic
  },
  medium: {
    credits: 120,
    amount: 1500, // $15.00 in cents
    name: 'Medium Pack',
    description: '120 minutes of processing',
    priceId: 'price_placeholder_medium' // Will be replaced by server-side logic
  },
  large: {
    credits: 500,
    amount: 4000, // $40.00 in cents
    name: 'Large Pack',
    description: '500 minutes of processing',
    priceId: 'price_placeholder_large' // Will be replaced by server-side logic
  }
} as const

export const STRIPE_SUBSCRIPTION_PRICES = {
  creator_monthly: 'price_placeholder_creator_monthly',
  creator_yearly: 'price_placeholder_creator_yearly',
  studio_monthly: 'price_placeholder_studio_monthly',
  studio_yearly: 'price_placeholder_studio_yearly'
} as const

export const STRIPE_CONFIG = {
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?canceled=true`,
}

// Helper function to get credit package info (safe for client-side)
export function getStripeCreditPackageInfo(packageKey: keyof typeof STRIPE_CREDIT_PACKAGES) {
  return STRIPE_CREDIT_PACKAGES[packageKey]
} 