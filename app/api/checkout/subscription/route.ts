import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { stripe, STRIPE_CONFIG, getStripeProductByTier } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { tier, userId, billingPeriod = 'monthly' } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!tier || !['creator', 'studio'].includes(tier)) {
      return NextResponse.json({ error: 'Valid tier required (creator or studio)' }, { status: 400 })
    }

    if (!billingPeriod || !['monthly', 'yearly'].includes(billingPeriod)) {
      return NextResponse.json({ error: 'Valid billing period required (monthly or yearly)' }, { status: 400 })
    }

    // Create server-side Supabase client with proper cookie handling
    const supabase = await createServerSupabaseClient()

    // Get authenticated user - getUser() is more secure than getSession()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser) {
      console.log('Auth error:', authError)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify the authenticated user matches the requested userId
    if (authUser.id !== userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 })
    }

    // Get user data from our database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, name, stripe_customer_id, subscription_tier')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user is already on this tier or higher
    if (userData.subscription_tier === tier) {
      return NextResponse.json({ error: `Already subscribed to ${tier} plan` }, { status: 400 })
    }

    if (userData.subscription_tier === 'studio' && tier === 'creator') {
      return NextResponse.json({ error: 'Cannot downgrade from Studio to Creator via checkout. Use billing portal.' }, { status: 400 })
    }

    let customerId = userData.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email || authUser.email,
        name: userData.name || authUser.user_metadata?.name || undefined,
        metadata: {
          userId: userId,
          source: 'stemify'
        }
      })
      customerId = customer.id

      // Update user with Stripe customer ID
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Get product configuration with billing period
    const product = getStripeProductByTier(tier, billingPeriod)

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: product.priceId,
          quantity: 1,
        },
      ],
      success_url: STRIPE_CONFIG.successUrl,
      cancel_url: STRIPE_CONFIG.cancelUrl,
      metadata: {
        userId: userId,
        tier: tier,
        billingPeriod: billingPeriod,
        type: 'subscription'
      },
      subscription_data: {
        metadata: {
          userId: userId,
          tier: tier,
          billingPeriod: billingPeriod
        }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto'
      }
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url
    })

  } catch (error) {
    console.error('Checkout session creation error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: `Failed to create checkout session: ${error.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 