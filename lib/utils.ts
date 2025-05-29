import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 50 * 1024 * 1024 // 50MB
  const supportedTypes = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/flac"]
  
  if (file.size > maxSize) {
    return { valid: false, error: "File size must be less than 50MB" }
  }
  
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: "Unsupported file format. Please use MP3, WAV, M4A, or FLAC" }
  }
  
  return { valid: true }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || ""
}

export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const extension = getFileExtension(originalName)
  const nameWithoutExt = originalName.replace(`.${extension}`, "")
  return `${nameWithoutExt}_${timestamp}.${extension}`
}
