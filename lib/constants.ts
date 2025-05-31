// Stemify App Constants

export const APP_CONFIG = {
  name: "Stemify",
  description: "AI-Powered Music Stem Separation",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  version: "1.0.0",
} as const;

export const AUDIO_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  supportedFormats: ["mp3", "wav", "m4a", "flac"],
  maxDuration: 600, // 10 minutes in seconds
} as const;

export const PRICING = {
  free: {
    minutes: 5,
    stems: 4,
    models: ["htdemucs"],
    watermark: true,
  },
  creator: {
    price: 9,
    minutes: 60,
    stems: 6,
    models: ["htdemucs_6s", "htdemucs_ft"],
    watermark: false,
  },
  studio: {
    price: 19,
    minutes: 200,
    stems: 6,
    models: ["htdemucs_6s", "htdemucs_ft"],
    watermark: false,
  },
} as const;

// Pay-as-you-go credit packages
export const CREDIT_PACKAGES = {
  small: {
    name: "Small",
    minutes: 30,
    price: 5,
    credits: 30, // 30 minutes = 30 credits (1:1 ratio)
  },
  medium: {
    name: "Medium", 
    minutes: 120,
    price: 15,
    credits: 120, // 120 minutes = 120 credits (1:1 ratio)
  },
  large: {
    name: "Large",
    minutes: 500,
    price: 40,
    credits: 500, // 500 minutes = 500 credits (1:1 ratio)
  },
} as const;

// Subscription tier configurations
export const SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    price: 0,
    monthlyMinutes: 5,
    maxStems: 4,
    availableStems: ["vocals", "drums", "bass", "other"],
    models: ["htdemucs"],
    features: ["4 stems", "320kbps MP3", "Watermark"],
    watermark: true,
  },
  creator: {
    name: "Creator", 
    price: 9,
    monthlyMinutes: 60,
    maxStems: 6,
    availableStems: ["vocals", "drums", "bass", "guitar", "piano", "other"],
    models: ["htdemucs_6s", "htdemucs_ft"],
    features: ["6 stems", "WAV + 320kbps MP3", "Fine-tuned model option"],
    watermark: false,
  },
  studio: {
    name: "Studio",
    price: 19,
    monthlyMinutes: 200,
    maxStems: 6,
    availableStems: ["vocals", "drums", "bass", "guitar", "piano", "other"],
    models: ["htdemucs_6s", "htdemucs_ft"],
    features: ["6 stems", "WAV + 320kbps MP3", "Fine-tuned model option"],
    watermark: false,
  },
} as const;

/**
 * Credit cost configuration for audio separation
 * 
 * PRICING MODEL:
 * - Base cost: 1.0 credit per minute of audio processing (corrected from 2.0)
 * - Model multipliers apply to base cost (not stem count)
 * - Stem count has NO impact on cost (Demucs processes all stems simultaneously)
 * 
 * Examples:
 * - 0.1 minutes (6 seconds) with htdemucs = 1.0 × 0.1 × 1 = 0.1 credits
 * - 0.1 minutes (6 seconds) with htdemucs_ft = 1.0 × 0.1 × 2 = 0.2 credits
 */
export const STEM_COSTS = {
  modelMultipliers: {
    'htdemucs': 1,        // Standard model: 1x cost
    'htdemucs_6s': 1,     // 6-stem model: 1x cost (same computational complexity)
    'htdemucs_ft': 2      // Fine-tuned model: 2x cost (4x slower processing = 2x credits)
  }
} as const;

export const STEM_TYPES = [
  "vocals",
  "drums", 
  "bass",
  "guitar",
  "piano",
  "other",
] as const;

export type StemType = typeof STEM_TYPES[number];

// Sieve AI Processing Configuration
export const SIEVE_CONFIG = {
  models: {
    free: "htdemucs", // 4 stems: vocals, drums, bass, other
    creator: "htdemucs_6s", // 6 stems: vocals, drums, bass, guitar, piano, other
    studio: "htdemucs_6s", // 6 stems: vocals, drums, bass, guitar, piano, other
  },
  modelOptions: {
    htdemucs: {
      stems: 4,
      availableStems: ["vocals", "drums", "bass", "other"],
      processingTime: "1x",
      description: "Standard 4-stem separation"
    },
    htdemucs_6s: {
      stems: 6,
      availableStems: ["vocals", "drums", "bass", "guitar", "piano", "other"],
      processingTime: "1x", 
      description: "6-stem separation with guitar and piano"
    },
    htdemucs_ft: {
      stems: 6,
      availableStems: ["vocals", "drums", "bass", "guitar", "piano", "other"],
      processingTime: "4x",
      description: "Fine-tuned model for highest quality (4x slower)"
    }
  },
  supportedFormats: ["mp3", "wav", "flac"],
} as const; 