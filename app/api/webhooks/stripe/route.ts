import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase'
import { refreshMonthlyCreditsWithClient, updateUserSubscriptionWithClient, addCredits } from '@/lib/credits'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('❌ No Stripe signature found')
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    )
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    // Verify webhook signature for security
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
    console.log('✅ Webhook signature verified:', event.type)
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    // Route events to appropriate handlers
    switch (event.type) {
      // Subscription Events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      // Payment Events
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      // Checkout Events  
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      // Customer Events
      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer)
        break

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`❌ Error processing webhook ${event.type}:`, error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Helper function to get user by Stripe customer ID
async function getUserByStripeCustomerId(customerId: string, sessionMetadata?: any) {
  const supabase = createServiceRoleClient()
  
  console.log(`🔍 DEBUGGING: Looking up customer ${customerId} with SERVICE ROLE`)
  console.log(`🔍 DEBUGGING: Session metadata:`, sessionMetadata)
  
  // First try: Direct lookup by stripe_customer_id
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single()

  console.log(`🔍 DEBUGGING: Direct lookup result:`, { user: user?.id, error })

  if (user && !error) {
    return user
  }

  console.log(`⚠️ Direct lookup failed for customer ${customerId}, trying fallback strategies...`)

  // Second try: If we have session metadata with userId, update the user record
  if (sessionMetadata?.userId) {
    console.log(`🔄 Attempting to link customer ${customerId} to user ${sessionMetadata.userId}`)
    
    // First, verify the user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', sessionMetadata.userId)
      .single()

    console.log(`🔍 DEBUGGING: User check result:`, { 
      userId: sessionMetadata.userId,
      existingUser: existingUser ? { id: existingUser.id, email: existingUser.email, stripe_customer_id: existingUser.stripe_customer_id } : null,
      userCheckError 
    })

    if (existingUser && !userCheckError) {
      // Update the user record with the stripe_customer_id
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', sessionMetadata.userId)
        .select()

      console.log(`🔍 DEBUGGING: Update result:`, { updateData, updateError })

      if (!updateError) {
        // Now fetch the updated user
        const { data: updatedUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionMetadata.userId)
          .single()

        console.log(`🔍 DEBUGGING: Fetch updated user result:`, { 
          updatedUser: updatedUser ? { id: updatedUser.id, stripe_customer_id: updatedUser.stripe_customer_id } : null, 
          fetchError 
        })

        if (updatedUser && !fetchError) {
          console.log(`✅ Successfully linked customer ${customerId} to user ${sessionMetadata.userId}`)
          return updatedUser
        }
      } else {
        console.error('❌ Failed to update user with stripe_customer_id:', updateError)
      }
    } else {
      console.error('❌ User does not exist:', sessionMetadata.userId, userCheckError)
    }
  }

  // Third try: Fetch customer from Stripe and match by email
  try {
    const stripeCustomer = await stripe.customers.retrieve(customerId) as Stripe.Customer
    
    console.log(`🔍 DEBUGGING: Stripe customer:`, { 
      id: stripeCustomer.id, 
      email: stripeCustomer.email 
    })
    
    if (stripeCustomer.email) {
      console.log(`🔄 Trying to find user by email: ${stripeCustomer.email}`)
      
      // First, let's see what users exist with this email
      const { data: allEmailUsers, error: allEmailError } = await supabase
        .from('users')
        .select('id, email, stripe_customer_id')
        .eq('email', stripeCustomer.email)

      console.log(`🔍 DEBUGGING: All users with email ${stripeCustomer.email}:`, { 
        allEmailUsers, 
        allEmailError 
      })

      const { data: emailUser, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', stripeCustomer.email)
        .is('stripe_customer_id', null)
        .single()

      console.log(`🔍 DEBUGGING: Email lookup (null stripe_customer_id):`, { 
        emailUser: emailUser ? { id: emailUser.id, email: emailUser.email } : null, 
        emailError 
      })

      if (emailUser && !emailError) {
        // Update the user with the stripe_customer_id
        const { data: linkData, error: linkError } = await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', emailUser.id)

        console.log(`🔍 DEBUGGING: Email link update:`, { linkData, linkError })

        if (!linkError) {
          console.log(`✅ Successfully linked customer ${customerId} to user ${emailUser.id} via email`)
          return { ...emailUser, stripe_customer_id: customerId }
        }
      }
    }
  } catch (stripeError) {
    console.error('❌ Failed to fetch customer from Stripe:', stripeError)
  }

  console.error('❌ All lookup strategies failed for Stripe customer:', customerId)
  return null
}

// Helper function to map Stripe price to our subscription tier
function mapStripePriceToTier(priceId: string): 'free' | 'creator' | 'studio' | null {
  const priceMapping = {
    [process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID!]: 'creator',
    [process.env.STRIPE_CREATOR_YEARLY_PRICE_ID!]: 'creator',
    [process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID!]: 'studio',
    [process.env.STRIPE_STUDIO_YEARLY_PRICE_ID!]: 'studio',
  } as const

  return priceMapping[priceId] || null
}

// Helper function to map Stripe price to credit amount for credit packages
function mapStripePriceToCredits(priceId: string): number {
  const creditMapping = {
    [process.env.STRIPE_CREDITS_SMALL_PRICE_ID!]: 30,
    [process.env.STRIPE_CREDITS_MEDIUM_PRICE_ID!]: 120, 
    [process.env.STRIPE_CREDITS_LARGE_PRICE_ID!]: 500,
  }

  return creditMapping[priceId] || 0
}

// Event Handlers

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🆕 Subscription created:', subscription.id)
  
  const user = await getUserByStripeCustomerId(subscription.customer as string)
  if (!user) return

  const priceId = subscription.items.data[0]?.price.id
  const tier = mapStripePriceToTier(priceId)
  
  if (!tier) {
    console.error('❌ Unknown price ID in subscription:', priceId)
    return
  }

  // Update user subscription in our database using service role client
  const supabase = createServiceRoleClient()
  const result = await updateUserSubscriptionWithClient(supabase, user.id, tier)
  
  if (result.success) {
    console.log(`✅ User ${user.id} subscription created: ${tier}`)
  } else {
    console.error('❌ Failed to update user subscription:', result.message)
  }

  // Update Stripe subscription ID in our database
  await supabase
    .from('users')
    .update({ stripe_subscription_id: subscription.id })
    .eq('id', user.id)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Subscription updated:', subscription.id)
  
  const user = await getUserByStripeCustomerId(subscription.customer as string)
  if (!user) return

  const priceId = subscription.items.data[0]?.price.id
  const tier = mapStripePriceToTier(priceId)
  
  if (!tier) {
    console.error('❌ Unknown price ID in subscription update:', priceId)
    return
  }

  const supabase = createServiceRoleClient()

  // Handle subscription status changes
  if (subscription.status === 'active') {
    const result = await updateUserSubscriptionWithClient(supabase, user.id, tier)
    
    if (result.success) {
      console.log(`✅ User ${user.id} subscription updated: ${tier}`)
    } else {
      console.error('❌ Failed to update user subscription:', result.message)
    }
  } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    // Downgrade to free tier
    const result = await updateUserSubscriptionWithClient(supabase, user.id, 'free')
    
    if (result.success) {
      console.log(`✅ User ${user.id} downgraded to free (subscription ${subscription.status})`)
    } else {
      console.error('❌ Failed to downgrade user:', result.message)
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('❌ Subscription deleted:', subscription.id)
  
  const user = await getUserByStripeCustomerId(subscription.customer as string)
  if (!user) return

  // Downgrade user to free tier using service role client
  const supabase = createServiceRoleClient()
  const result = await updateUserSubscriptionWithClient(supabase, user.id, 'free')
  
  if (result.success) {
    console.log(`✅ User ${user.id} downgraded to free (subscription deleted)`)
  } else {
    console.error('❌ Failed to downgrade user:', result.message)
  }

  // Clear Stripe subscription ID
  await supabase
    .from('users')
    .update({ stripe_subscription_id: null })
    .eq('id', user.id)
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Invoice payment succeeded:', invoice.id)
  
  const user = await getUserByStripeCustomerId(invoice.customer as string)
  if (!user) return

  // Check if this is a subscription renewal
  const subscriptionId = (invoice as any).subscription as string | null
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = subscription.items.data[0]?.price.id
    const tier = mapStripePriceToTier(priceId)
    
    if (tier) {
      // Check if this is the first invoice (subscription creation) or a renewal
      const isFirstInvoice = (invoice as any).billing_reason === 'subscription_create'
      
      if (isFirstInvoice) {
        console.log(`ℹ️ Skipping credit refresh for subscription creation (credits already allocated by tier update)`)
      } else {
        // This is a genuine monthly renewal - refresh credits
        console.log(`🔄 Monthly renewal detected - refreshing credits for user ${user.id}: ${tier}`)
        
        const supabase = createServiceRoleClient()
        const result = await refreshMonthlyCreditsWithClient(supabase, user.id, tier)
        
        if (result.success) {
          console.log(`✅ Monthly credits refreshed for user ${user.id}: ${tier}`)
        } else {
          console.error('❌ Failed to refresh monthly credits:', result.message)
        }
      }
    }
  }

  // Log successful payment
  const supabase = createServiceRoleClient()
  const paymentIntentId = (invoice as any).payment_intent as string | null
  await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      stripe_payment_intent_id: paymentIntentId,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      type: subscriptionId ? 'subscription' : 'one_time',
      stripe_invoice_id: invoice.id
    })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('💸 Invoice payment failed:', invoice.id)
  
  const user = await getUserByStripeCustomerId(invoice.customer as string)
  if (!user) return

  // Log failed payment
  const supabase = createServiceRoleClient()
  const paymentIntentId = (invoice as any).payment_intent as string | null
  const subscriptionId = (invoice as any).subscription as string | null
  
  await supabase
    .from('payments')
    .insert({
      user_id: user.id,
      stripe_payment_intent_id: paymentIntentId,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      type: subscriptionId ? 'subscription' : 'one_time',
      stripe_invoice_id: invoice.id
    })

  // TODO: You might want to send an email notification to the user
  console.log(`⚠️ Payment failed for user ${user.id}, consider sending notification`)
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('🛒 Checkout session completed:', session.id)
  
  // CRITICAL: This is the primary place where we link users to Stripe customers
  // This fires FIRST, before subscription.created, so we need to ensure linking happens here
  
  let user = await getUserByStripeCustomerId(session.customer as string, session.metadata)
  
  // If user linking failed, we have a critical issue that needs immediate resolution
  if (!user) {
    console.error(`🚨 CRITICAL: Failed to link user for checkout session ${session.id}`)
    console.error(`Customer: ${session.customer}, Metadata:`, session.metadata)
    
    // Last resort: try to link by email from the session
    if (session.customer_details?.email) {
      console.log(`🔄 Last resort: trying to link by session email ${session.customer_details.email}`)
      
      const supabase = createServiceRoleClient()
      const { data: emailUser, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.customer_details.email)
        .is('stripe_customer_id', null)
        .single()

      if (emailUser && !emailError) {
        const { error: linkError } = await supabase
          .from('users')
          .update({ stripe_customer_id: session.customer as string })
          .eq('id', emailUser.id)

        if (!linkError) {
          user = { ...emailUser, stripe_customer_id: session.customer as string }
          console.log(`✅ Emergency link successful via session email for user ${user.id}`)
        }
      }
    }
    
    if (!user) {
      console.error(`🚨 TOTAL FAILURE: Cannot link user for session ${session.id} - this will cause database inconsistency`)
      return
    }
  }

  console.log(`✅ User linked successfully: ${user.id} ↔ ${session.customer}`)

  // Handle subscription checkout vs one-time purchases
  if (session.mode === 'subscription') {
    console.log(`🔄 Processing subscription checkout for user ${user.id}`)
    
    // For subscription mode, the subscription.created event will handle the actual subscription logic
    // We just need to ensure the customer is linked, which we've done above
    console.log(`✅ Subscription checkout linking complete - subscription.created will handle the rest`)
    
  } else if (session.mode === 'payment') {
    console.log(`💳 Processing one-time payment (credit purchase) for user ${user.id}`)
    
    // Handle credit purchases using session metadata for reliability
    if (session.metadata?.type === 'credits' && session.metadata?.credits) {
      const credits = parseInt(session.metadata.credits)
      
      if (credits > 0) {
        console.log(`💰 Adding ${credits} credits to user ${user.id} from session metadata`)
        
        // Use service role client for webhook operations
        const supabase = createServiceRoleClient()
        
        const { data, error } = await supabase
          .rpc('add_credits_with_total', {
            user_id: user.id,
            credits_amount: credits,
            payment_id: session.payment_intent as string,
            description: `Credit purchase: ${credits} credits via ${session.metadata.packageKey} package`
          })

        if (error) {
          console.error('❌ Failed to add credits via RPC:', error)
          return
        }

        console.log(`✅ Added ${credits} credits to user ${user.id}. New balance: ${data}`)
        
        // Log the payment in our payments table
        await supabase
          .from('payments')
          .insert({
            user_id: user.id,
            stripe_payment_intent_id: session.payment_intent as string,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            status: 'succeeded',
            type: 'credits',
            stripe_session_id: session.id
          })
          
      } else {
        console.error('❌ Invalid credit amount in session metadata:', session.metadata.credits)
      }
    } else {
      console.log(`⚠️ No credit metadata found, falling back to line item lookup`)
      
      // Fallback: Handle credit purchases via line items
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
      
      for (const item of lineItems.data) {
        const priceId = item.price?.id
        if (priceId) {
          const credits = mapStripePriceToCredits(priceId)
          
          if (credits > 0) {
            console.log(`💰 Adding ${credits} credits to user ${user.id} from price ID ${priceId}`)
            
            // Use service role client for webhook operations
            const supabase = createServiceRoleClient()
            
            const { data, error } = await supabase
              .rpc('add_credits_with_total', {
                user_id: user.id,
                credits_amount: credits,
                payment_id: session.payment_intent as string,
                description: `Credit purchase: ${credits} credits`
              })

            if (error) {
              console.error('❌ Failed to add credits via RPC:', error)
              continue
            }

            console.log(`✅ Added ${credits} credits to user ${user.id}. New balance: ${data}`)
            
            // Log the payment in our payments table
            await supabase
              .from('payments')
              .insert({
                user_id: user.id,
                stripe_payment_intent_id: session.payment_intent as string,
                amount: session.amount_total || 0,
                currency: session.currency || 'usd',
                status: 'succeeded',
                type: 'credits',
                stripe_session_id: session.id
              })
          } else {
            console.log(`⚠️ No credits found for price ID: ${priceId}`)
          }
        }
      }
    }
  }
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log('👤 Customer created:', customer.id)
  
  // Customer creation is handled in our checkout API
  // This is mainly for logging purposes
} 