"use client"

import { createContext, useContext, useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import type { User, AuthError } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  error: AuthError | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Separate component to handle search params with Suspense
function SearchParamsHandler({ 
  onSignedIn 
}: { 
  onSignedIn: (redirectTo?: string) => void 
}) {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // This will only run on the client side within Suspense boundary
    const handleSignIn = () => {
      const redirectTo = searchParams.get('redirectTo')
      onSignedIn(redirectTo || undefined)
    }
    
    // Store the function for external access
    ;(window as any).handleAuthSignIn = handleSignIn
  }, [searchParams, onSignedIn])
  
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignedIn = (redirectTo?: string) => {
    // Only redirect if we're currently on the home page
    if (window.location.pathname === '/') {
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.push('/dashboard')
      }
    }
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          setError(error)
        } else {
          setUser(user)
          setError(null)
        }
      } catch (err) {
        console.error('Auth error:', err)
        setError(err as AuthError)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        setError(null)

        // Handle auth events - only redirect on actual sign-in, not session restoration
        if (event === 'SIGNED_IN' && session?.user) {
          // Use the window function if available (client-side)
          if (typeof window !== 'undefined' && (window as any).handleAuthSignIn) {
            ;(window as any).handleAuthSignIn()
          } else {
            // Fallback for server-side or when search params handler isn't ready
            if (window.location.pathname === '/') {
              router.push('/dashboard')
            }
          }
        } else if (event === 'SIGNED_OUT') {
          router.push('/')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth, router])

  const signIn = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Use environment variable instead of window.location.origin for consistency
      const redirectUrl = process.env.NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL || `${window.location.origin}/auth/callback`
      console.log('🔍 OAuth Debug Info:')
      console.log('window.location.origin:', window.location.origin)
      console.log('NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL:', process.env.NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL)
      console.log('Final redirect URL being used:', redirectUrl)
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (error) {
        console.error('OAuth Error:', error)
        setError(error)
        setLoading(false)
      }
    } catch (err) {
      console.error('Sign in error:', err)
      setError(err as AuthError)
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setError(error)
      }
    } catch (err) {
      console.error('Sign out error:', err)
      setError(err as AuthError)
    } finally {
      setLoading(false)
    }
  }

  const clearError = () => {
    setError(null)
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error, 
      signIn, 
      signOut, 
      clearError 
    }}>
      <Suspense fallback={null}>
        <SearchParamsHandler onSignedIn={handleSignedIn} />
      </Suspense>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 