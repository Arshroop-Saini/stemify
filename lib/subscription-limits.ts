import { createClient } from '@/lib/supabase'

export interface UserUsage {
  // Current month usage
  monthlyAudioMinutesUsed: number
  monthlySeparationsCount: number
  monthlyFilesUploaded: number
  
  // Cumulative usage (all-time)
  totalAudioMinutesProcessed: number
  totalSeparationsCreated: number
  totalFilesUploaded: number
  
  // Subscription info
  subscriptionTier: 'free' | 'creator' | 'studio'
}

export class SubscriptionService {
  private supabase = createClient()

  async getUserUsage(userId: string): Promise<UserUsage> {
    try {
      // Get user's subscription tier
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', userId)
        .single()
      
      if (userError) throw userError

      // Get current month usage
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
      
      const { data: usageData, error: usageError } = await this.supabase
        .from('user_usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('month_year', currentMonth)
        .single()

      return {
        monthlyAudioMinutesUsed: usageData?.monthly_audio_minutes_used || 0,
        monthlySeparationsCount: usageData?.monthly_separations_count || 0,
        monthlyFilesUploaded: usageData?.monthly_files_uploaded || 0,
        totalAudioMinutesProcessed: usageData?.total_audio_minutes_processed || 0,
        totalSeparationsCreated: usageData?.total_separations_created || 0,
        totalFilesUploaded: usageData?.total_files_uploaded || 0,
        subscriptionTier: (userData?.subscription_tier || 'free') as 'free' | 'creator' | 'studio'
      }
    } catch (error) {
      console.error('Error getting user usage:', error)
      return {
        monthlyAudioMinutesUsed: 0,
        monthlySeparationsCount: 0,
        monthlyFilesUploaded: 0,
        totalAudioMinutesProcessed: 0,
        totalSeparationsCreated: 0,
        totalFilesUploaded: 0,
        subscriptionTier: 'free'
      }
    }
  }

  async recordAudioUsage(userId: string, audioMinutes: number): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('record_audio_usage', {
        p_user_id: userId,
        p_audio_minutes: audioMinutes
      })
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error recording audio usage:', error)
      return false
    }
  }

  async recordSeparationUsage(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('record_separation_usage', {
        p_user_id: userId
      })
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error recording separation usage:', error)
      return false
    }
  }

  async recordFileUploadUsage(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('record_file_upload_usage', {
        p_user_id: userId
      })
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error recording file upload usage:', error)
      return false
    }
  }
}

export const subscriptionService = new SubscriptionService() 