"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BillingPortalButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  children?: React.ReactNode
  className?: string
}

export function BillingPortalButton({ 
  variant = 'outline',
  size = 'default',
  children,
  className 
}: BillingPortalButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleOpenPortal = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to open billing portal')
      }

      const { url } = await response.json()
      
      // Redirect to Stripe Customer Portal
      window.location.href = url
      
    } catch (error) {
      console.error('Error opening billing portal:', error)
      const message = error instanceof Error ? error.message : 'Failed to open billing portal'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleOpenPortal}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Opening...
        </>
      ) : (
        <>
          {children || (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Manage Billing
              <ExternalLink className="w-4 h-4 ml-2" />
            </>
          )}
        </>
      )}
    </Button>
  )
} 