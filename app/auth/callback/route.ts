import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { initializeUserCredits } from '@/lib/credits'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options)
          },
          remove(name: string, options: any) {
            cookieStore.delete(name)
          },
        },
      }
    )
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth error:', error)
        return NextResponse.redirect(`${requestUrl.origin}/auth/error?message=${error.message}`)
      }

      if (data.user) {
        // Check if this is a new user by looking at their created_at timestamp
        const userCreatedAt = new Date(data.user.created_at!)
        const now = new Date()
        const timeDifference = now.getTime() - userCreatedAt.getTime()
        const isNewUser = timeDifference < 60000 // Less than 1 minute old = new user

        if (isNewUser) {
          console.log('New user detected, initializing credits...')
          
          // Initialize proper credits for new user
          const result = await initializeUserCredits(data.user.id, 'free')
          
          if (result.success) {
            console.log('Credits initialized successfully for new user')
          } else {
            console.error('Failed to initialize credits for new user:', result.message)
          }
        }
      }
    } catch (error) {
      console.error('Callback error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/auth/error?message=Authentication failed`)
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
} 