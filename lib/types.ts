// Stemify TypeScript Types

import { StemType } from "./constants";

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  subscription_tier: "free" | "creator" | "studio";
  credits_remaining: number;
  created_at: string;
  updated_at: string;
}

// Extended user type with dashboard statistics
export interface UserDashboard extends User {
  total_files_uploaded: number;
  completed_jobs: number;
  total_storage_used_mb: number;
  total_processing_time_seconds: number;
}

export interface AudioFile {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  duration: number;
  format: string;
  storage_path: string;
  created_at: string;
  expires_at: string;
}

export interface SeparationJob {
  id: string;
  user_id: string;
  audio_file_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  selected_stems: StemType[];
  quality: "standard" | "pro";
  progress: number;
  error_message?: string;
  result_files?: SeparatedStem[];
  credits_used: number;
  created_at: string;
  completed_at?: string;
}

export interface SeparatedStem {
  stem_type: StemType;
  file_path: string;
  file_size: number;
  download_url?: string;
}

export interface Payment {
  id: string;
  user_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed";
  credits_purchased: number;
  created_at: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
} 