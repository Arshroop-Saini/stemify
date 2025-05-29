"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { UserDashboard } from '@/lib/types'

export function UserProfile() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_dashboard')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <CardTitle className="font-heading">
                {profile?.name || user.user_metadata?.full_name || 'User'}
              </CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">
              {profile?.credits_remaining || 0}
            </div>
            <div className="text-sm text-muted-foreground">Credits Left</div>
          </div>
          <div className="text-center">
            <Badge variant={profile?.subscription_tier === 'free' ? 'secondary' : 'default'}>
              {profile?.subscription_tier || 'free'}
            </Badge>
            <div className="text-sm text-muted-foreground mt-1">Plan</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {profile?.total_files_uploaded || 0}
            </div>
            <div className="text-sm text-muted-foreground">Files Uploaded</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {profile?.completed_jobs || 0}
            </div>
            <div className="text-sm text-muted-foreground">Jobs Completed</div>
          </div>
        </div>
        
        {profile?.total_storage_used_mb && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Storage Used: {profile.total_storage_used_mb} MB
            </div>
            {profile.total_processing_time_seconds > 0 && (
              <div className="text-sm text-muted-foreground">
                Total Processing Time: {Math.round(profile.total_processing_time_seconds / 60)} minutes
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 