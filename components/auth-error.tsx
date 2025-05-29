"use client"

import { useAuth } from '@/components/auth-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export function AuthError() {
  const { error, clearError } = useAuth()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (error) {
      setIsVisible(true)
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setIsVisible(false)
        clearError()
      }, 10000)
      
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  if (!error || !isVisible) return null

  const getErrorMessage = (error: any) => {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password. Please try again.'
      case 'Email not confirmed':
        return 'Please check your email and click the confirmation link.'
      case 'Too many requests':
        return 'Too many login attempts. Please wait a moment and try again.'
      default:
        return error.message || 'An authentication error occurred. Please try again.'
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    clearError()
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Card className="border-destructive bg-destructive/5 shadow-lg">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <svg 
              className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              strokeWidth="2"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-destructive mb-1">Authentication Error</h4>
              <p className="text-sm text-destructive/80">
                {getErrorMessage(error)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-destructive hover:text-destructive/80 p-1 h-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 