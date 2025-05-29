# Sieve Integration Documentation

## Overview
Stemify uses **Sieve** for AI-powered music source separation. Sieve provides the Demucs model which is a state-of-the-art music source separation model, currently capable of separating drums, bass, vocals, and other instruments from audio files.

## Sieve Demucs API

### What is Demucs?
Demucs is a state-of-the-art music source separation model based on a U-Net convolutional architecture inspired by Wave-U-Net. The v4 version features Hybrid Transformer Demucs, a hybrid spectrogram/waveform separation model using Transformers with cross-domain attention. The model achieves a SDR of 9.20 dB on the MUSDB HQ test set.

### Stem Output Order

**Default (4 stems):**
1. Vocals
2. Drums  
3. Bass
4. Other

**htdemucs_6s model (6 stems):**
1. Vocals
2. Drums
3. Bass
4. Other
5. Guitar
6. Piano

**Two-stem mode:**
1. Selected stem
2. All other stems combined

## Available Models

| Model | Description | Quality | Speed |
|-------|-------------|---------|-------|
| `htdemucs` | First Hybrid Transformer version | Good | Fast |
| `htdemucs_ft` | Fine-tuned version (DEFAULT) | Better | 4x slower |
| `htdemucs_6s` | 6-source version (adds guitar/piano) | Good | Fast |
| `hdemucs_mmi` | Hybrid Demucs v3 | Good | Fast |
| `mdx` | MDX challenge winner | Good | Fast |
| `mdx_extra` | Extra training data | Better | Fast |
| `mdx_q` | Quantized MDX | Lower quality | Fastest |
| `mdx_extra_q` | Quantized MDX Extra | Lower quality | Fastest |

## API Usage

**IMPORTANT**: Sieve only provides a Python SDK, not REST API endpoints. For Next.js integration, we need to create a Python service.

### Installation
```bash
pip install sievedata
```

### Authentication
```bash
sieve login
```

### Basic Usage (Synchronous)
```python
import sieve

# Upload file
file = sieve.File(url="https://example.com/audio.mp3")

# Configure separation
model = "htdemucs_ft"  # Default recommended
two_stems = "None"     # Or "vocals", "drums", etc.
overlap = 0.25         # 25% overlap (default)
shifts = 0             # No shifts (faster)
audio_format = "wav"   # Output format

# Run separation
demucs = sieve.function.get("sieve/demucs")
output = demucs.run(
    file=file,
    model=model,
    two_stems=two_stems,
    overlap=overlap,
    shifts=shifts,
    audio_format=audio_format
)
```

### Async Usage (Recommended for Production)
```python
import sieve

# Same parameters as above
demucs = sieve.function.get("sieve/demucs")
job = demucs.push(file, model, two_stems, overlap, shifts, audio_format)

# Non-blocking - can do other work
print("Job submitted, processing in background...")

# Get results when ready
result = job.result()  # This blocks until complete
```

## Parameters

### Inputs
- **file**: `sieve.File` - Audio file (mp3, wav, flac) to be separated
- **model**: Model to use for separation (default: "htdemucs_ft")
- **two_stems**: "None" | "vocals" | "drums" | "bass" | "other" | "guitar" | "piano" - Only separate into stem and no_stem
- **overlap**: `float` - Overlap between prediction windows (default: 0.25)
- **shifts**: `int` - Number of shifts for prediction averaging (default: 0)
- **audio_format**: "wav" | "mp3" | "flac" - Output format (default: "wav")

### Outputs
- **output**: Array of separated audio files

## Integration with Stemify

Since Sieve only provides Python SDK, we need a Python service to handle the separation:

### Architecture
```
Next.js App → Python FastAPI Service → Sieve SDK → Demucs Model
```

### Python Service Implementation
```python
# python-api/main.py
import sieve
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio

app = FastAPI()

class SeparationRequest(BaseModel):
    audio_url: str
    model: str = "htdemucs_ft"
    two_stems: str = "None"
    overlap: float = 0.25
    shifts: int = 0
    audio_format: str = "wav"

@app.post("/separate")
async def separate_audio(request: SeparationRequest):
    try:
        # Create Sieve file from URL
        file = sieve.File(url=request.audio_url)
        
        # Get Demucs function
        demucs = sieve.function.get("sieve/demucs")
        
        # Start async job
        job = demucs.push(
            file=file,
            model=request.model,
            two_stems=request.two_stems,
            overlap=request.overlap,
            shifts=request.shifts,
            audio_format=request.audio_format
        )
        
        return {"job_id": job.id, "status": "processing"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{job_id}")
async def get_job_status(job_id: str):
    try:
        # Get job status from Sieve
        # Implementation depends on Sieve's job tracking API
        return {"job_id": job_id, "status": "completed", "result": "..."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Next.js API Route
```typescript
// app/api/separate/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // Call Python service
  const response = await fetch(process.env.PYTHON_API_URL + '/separate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: body.audioUrl,
      model: body.model || 'htdemucs_ft',
      two_stems: body.twoStems || 'None',
      overlap: body.overlap || 0.25,
      shifts: body.shifts || 0,
      audio_format: body.audioFormat || 'wav'
    })
  })
  
  return NextResponse.json(await response.json())
}
```

## Stemify-Specific Configuration

### Quality Tiers
```python
QUALITY_CONFIGS = {
    "free": {
        "model": "htdemucs",
        "overlap": 0.1,
        "shifts": 0,
        "audio_format": "mp3",
        "two_stems": "vocals"  # Only vocals separation
    },
    "creator": {
        "model": "htdemucs_ft", 
        "overlap": 0.25,
        "shifts": 0,
        "audio_format": "wav",
        "two_stems": "None"  # Full separation
    },
    "studio": {
        "model": "htdemucs_ft",
        "overlap": 0.25, 
        "shifts": 1,  # Better quality
        "audio_format": "wav",
        "two_stems": "None"  # Full separation with 6 stems
    }
}
```

### Stem Selection Mapping
```python
STEM_MAPPING = {
    "vocals": "vocals",
    "drums": "drums", 
    "bass": "bass",
    "guitar": "guitar",  # Only available with htdemucs_6s
    "piano": "piano",    # Only available with htdemucs_6s
    "other": "other"
}
```

## Deployment Strategy

1. **Python Service**: Deploy FastAPI service to Railway, Render, or similar
2. **Environment Variables**: Set `PYTHON_API_URL` in Vercel
3. **Authentication**: Handle Sieve authentication in Python service
4. **File Handling**: Use public URLs for audio files

## Next Steps for Implementation

1. ✅ Create Python FastAPI service
2. ✅ Deploy Python service to Railway/Render  
3. ✅ Update Next.js API to call Python service
4. ✅ Implement job status polling
5. ✅ Test end-to-end integration 