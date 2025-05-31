import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { stripe, getStripeCreditPackage, STRIPE_CONFIG } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { packageKey, userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!packageKey || !['small', 'medium', 'large'].includes(packageKey)) {
      return NextResponse.json({ error: 'Valid package key required (small, medium, large)' }, { status: 400 })
    }

    // Create server-side Supabase client with proper cookie handling
    const supabase = await createServerSupabaseClient()

    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify the authenticated user matches the requested userId
    if (authUser.id !== userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 })
    }

    // Get user data from our database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, name, stripe_customer_id')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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

    // Get credit package configuration
    const creditPackage = getStripeCreditPackage(packageKey as keyof typeof import('@/lib/stripe').STRIPE_CREDIT_PACKAGES)

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment', // One-time payment for credits
      line_items: [
        {
          price: creditPackage.priceId,
          quantity: 1,
        },
      ],
      success_url: STRIPE_CONFIG.successUrl,
      cancel_url: STRIPE_CONFIG.cancelUrl,
      metadata: {
        userId: userId,
        packageKey: packageKey,
        credits: creditPackage.credits.toString(),
        type: 'credits'
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
    console.error('Credit checkout session creation error:', error)
    
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