import { createClient } from '@/lib/supabase'
import { subscriptionService } from '@/lib/subscription-limits'

export interface UserStats {
  // Audio content limits (minutes of audio that can be processed)
  minutesUsed: number
  minutesLimit: number
  minutesRemaining: number
  
  // File stats (cumulative - never decrease)
  filesUploaded: number
  totalSeparations: number
  completedSeparations: number
  
  // Subscription info
  subscriptionTier: 'free' | 'creator' | 'studio'
  creditsRemaining: number
  creditsUsed: number
  
  // Storage
  storageUsedMB: number
}

// Simple tier limits for analytics display
const TIER_LIMITS = {
  free: { minutesPerMonth: 5 },
  creator: { minutesPerMonth: 60 },
  studio: { minutesPerMonth: 200 }
}

export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    // Get usage data from new tracking system
    const usage = await subscriptionService.getUserUsage(userId)
    const limits = TIER_LIMITS[usage.subscriptionTier]
    
    // Get current files and storage (for active storage calculation)
    const supabase = createClient()
    const { data: currentFiles } = await supabase
      .from('audio_files')
      .select('file_size')
      .eq('user_id', userId)
      .eq('upload_status', 'completed')
    
    const currentStorageMB = currentFiles?.reduce((total, file) => {
      return total + (file.file_size || 0)
    }, 0) || 0
    
    // Get credits from users table
    const { data: userData } = await supabase
      .from('users')
      .select('credits_remaining')
      .eq('id', userId)
      .single()
    
    return {
      // Monthly audio content usage
      minutesUsed: usage.monthlyAudioMinutesUsed,
      minutesLimit: limits.minutesPerMonth,
      minutesRemaining: Math.max(0, limits.minutesPerMonth - usage.monthlyAudioMinutesUsed),
      
      // Cumulative stats (never decrease)
      filesUploaded: usage.totalFilesUploaded,
      totalSeparations: usage.totalSeparationsCreated,
      completedSeparations: usage.totalSeparationsCreated, // All tracked separations are completed
      
      // Subscription info
      subscriptionTier: usage.subscriptionTier,
      creditsRemaining: userData?.credits_remaining || 0,
      creditsUsed: 0, // TODO: Implement credit tracking
      
      // Current active storage
      storageUsedMB: Math.round(currentStorageMB / (1024 * 1024) * 100) / 100
    }
    
  } catch (error) {
    console.error('Error getting user stats:', error)
    return getDefaultStats()
  }
}

function getDefaultStats(): UserStats {
  return {
    minutesUsed: 0,
    minutesLimit: 5,
    minutesRemaining: 5,
    filesUploaded: 0,
    totalSeparations: 0,
    completedSeparations: 0,
    subscriptionTier: 'free',
    creditsRemaining: 0,
    creditsUsed: 0,
    storageUsedMB: 0
  }
}

export function getTierDisplayName(tier: string): string {
  switch (tier) {
    case 'creator': return 'Creator'
    case 'studio': return 'Studio' 
    default: return 'Free'
  }
} 