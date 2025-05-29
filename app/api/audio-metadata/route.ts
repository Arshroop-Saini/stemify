import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

interface AudioMetadata {
  duration?: number
  format?: string
  bitrate?: number
  sampleRate?: number
  channels?: number
}

/**
 * Extract audio metadata using ffprobe (production-grade accuracy)
 * This is the gold standard for audio file analysis
 */
async function extractAudioMetadata(filePath: string): Promise<AudioMetadata> {
  try {
    // Use ffprobe to extract comprehensive metadata
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
    
    const { stdout } = await execAsync(command)
    const metadata = JSON.parse(stdout)
    
    // Find the audio stream
    const audioStream = metadata.streams?.find((stream: any) => stream.codec_type === 'audio')
    const format = metadata.format
    
    if (!audioStream || !format) {
      throw new Error('No audio stream found in file')
    }
    
    return {
      duration: parseFloat(format.duration) || parseFloat(audioStream.duration),
      format: format.format_name?.split(',')[0] || 'unknown',
      bitrate: parseInt(format.bit_rate) || parseInt(audioStream.bit_rate),
      sampleRate: parseInt(audioStream.sample_rate),
      channels: parseInt(audioStream.channels)
    }
  } catch (error) {
    console.error('ffprobe metadata extraction failed:', error)
    throw new Error('Failed to extract audio metadata')
  }
}

/**
 * Check if ffprobe is available on the system
 */
async function checkFFProbeAvailability(): Promise<boolean> {
  try {
    await execAsync('ffprobe -version')
    return true
  } catch (error) {
    console.error('ffprobe not available:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null
  let tempDir: string | null = null
  
  try {
    // Check if ffprobe is available
    const ffprobeAvailable = await checkFFProbeAvailability()
    if (!ffprobeAvailable) {
      return NextResponse.json({
        error: 'ffprobe not available - audio analysis not possible',
        suggestion: 'Install ffmpeg to enable accurate audio metadata extraction'
      }, { status: 503 })
    }
    
    // Parse the uploaded file
    const formData = await request.formData()
    const audioFile = formData.get('audio_file') as File
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }
    
    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/flac', 'audio/ogg']
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json({ 
        error: 'Unsupported audio format',
        supportedFormats: ['MP3', 'WAV', 'M4A', 'FLAC', 'OGG']
      }, { status: 400 })
    }
    
    // Create temporary directory
    tempDir = await mkdtemp(join(tmpdir(), 'audio-metadata-'))
    
    // Write uploaded file to temporary location
    const fileExtension = audioFile.name.split('.').pop()?.toLowerCase() || 'tmp'
    tempFilePath = join(tempDir, `audio.${fileExtension}`)
    
    const arrayBuffer = await audioFile.arrayBuffer()
    await writeFile(tempFilePath, Buffer.from(arrayBuffer))
    
    console.log(`Analyzing audio file: ${audioFile.name} (${audioFile.size} bytes)`)
    
    // Extract metadata using ffprobe
    const metadata = await extractAudioMetadata(tempFilePath)
    
    console.log('Extracted metadata:', metadata)
    
    // Validate extracted data
    if (!metadata.duration || metadata.duration <= 0) {
      throw new Error('Invalid duration extracted from audio file')
    }
    
    return NextResponse.json({
      success: true,
      duration: Math.round(metadata.duration * 10) / 10, // Round to 1 decimal place
      format: metadata.format,
      bitrate: metadata.bitrate,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
      fileSize: audioFile.size,
      fileName: audioFile.name
    })
    
  } catch (error) {
    console.error('Audio metadata extraction error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json({
      error: 'Failed to extract audio metadata',
      details: errorMessage,
      suggestion: 'Please ensure the audio file is valid and not corrupted'
    }, { status: 500 })
    
  } finally {
    // Cleanup temporary files
    try {
      if (tempFilePath) {
        await unlink(tempFilePath)
      }
      if (tempDir) {
        // Note: We only delete the file, not the directory to avoid race conditions
        // The OS will clean up temporary directories automatically
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError)
    }
  }
} 