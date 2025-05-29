import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { updateUserSubscription, initializeUserCredits } from '@/lib/credits'

export async function POST(request: NextRequest) {
  try {
    const { action, tier, userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = createClient()

    // Verify user exists and get current session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    switch (action) {
      case 'upgrade':
      case 'downgrade':
      case 'change':
        if (!tier || !['free', 'creator', 'studio'].includes(tier)) {
          return NextResponse.json({ error: 'Valid tier required' }, { status: 400 })
        }

        const result = await updateUserSubscription(userId, tier)
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: result.message,
            creditsRemaining: result.creditsRemaining,
            tier
          })
        } else {
          return NextResponse.json({ error: result.message }, { status: 500 })
        }

      case 'initialize':
        // For new users or resetting credits
        const initResult = await initializeUserCredits(userId, tier || 'free')
        
        if (initResult.success) {
          return NextResponse.json({
            success: true,
            message: initResult.message,
            creditsRemaining: initResult.creditsRemaining
          })
        } else {
          return NextResponse.json({ error: initResult.message }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Subscription API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = createClient()

    // Get user subscription info
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_tier, total_credits, credits_remaining')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      subscriptionTier: user.subscription_tier,
      totalCredits: user.total_credits,
      creditsRemaining: user.credits_remaining
    })
  } catch (error) {
    console.error('Get subscription error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 