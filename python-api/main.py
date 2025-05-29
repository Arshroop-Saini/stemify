import sieve
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from typing import Optional, List, Dict, Any
import asyncio
import logging
import tempfile
from supabase import create_client, Client
import uuid
from dotenv import load_dotenv

# Load environment variables from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Stemify Sieve API", version="1.0.0")

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL", "https://wqzretaqqqtzxdtoljqr.supabase.co")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not supabase_key or supabase_key == "your_service_role_key_here":
    logger.warning("SUPABASE_SERVICE_ROLE_KEY not set! File uploads will fail.")
    logger.warning("Please get the service role key from: https://supabase.com/dashboard/project/wqzretaqqqtzxdtoljqr/settings/api")
    supabase: Client = None
else:
    supabase: Client = create_client(supabase_url, supabase_key)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SeparationRequest(BaseModel):
    audio_url: str
    model: str = "htdemucs_ft"
    two_stems: str = "None"
    overlap: float = 0.25
    shifts: int = 0
    audio_format: str = "wav"
    selected_stems: Optional[List[str]] = None
    quality: Optional[str] = "standard"

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None

async def upload_file_to_supabase(file_path: str, stem_name: str, user_id: str) -> Optional[str]:
    """Upload a file to Supabase storage and return the public URL"""
    if not supabase:
        logger.error("Supabase client not initialized - cannot upload files")
        return None
        
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        storage_path = f"{user_id}/separated/{file_id}_{stem_name}.wav"
        
        # Read file content
        with open(file_path, 'rb') as file:
            file_content = file.read()
        
        # Upload to Supabase storage with correct content type
        result = supabase.storage.from_("audio-files").upload(
            storage_path, 
            file_content,
            file_options={
                "content-type": "audio/wav",
                "cache-control": "3600"
            }
        )
        
        # In newer versions, successful uploads don't have .error attribute
        # Errors are raised as exceptions instead
        logger.info(f"Upload successful for {stem_name}")
        
        # Get public URL - in newer Supabase Python client, this returns the URL directly
        public_url = supabase.storage.from_("audio-files").get_public_url(storage_path)
        
        # Handle both old and new API formats
        if isinstance(public_url, dict):
            public_url = public_url.get('publicURL') or public_url.get('publicUrl') or public_url.get('public_url')
        
        # Clean up any trailing query parameters that might cause issues
        if public_url and public_url.endswith('?'):
            public_url = public_url.rstrip('?')
        
        logger.info(f"Successfully uploaded {stem_name} to {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"Error uploading {stem_name}: {str(e)}")
        return None

@app.get("/")
async def root():
    return {"message": "Stemify Sieve API is running", "version": "1.0.0"}

@app.post("/separate")
async def separate_audio(request: SeparationRequest):
    """
    Start audio separation using Sieve Demucs model (synchronous)
    """
    try:
        logger.info(f"Starting separation for URL: {request.audio_url}")
        logger.info(f"Parameters: model={request.model}, two_stems={request.two_stems}, quality={request.quality}")
        
        # Extract user_id from the URL path (temporary solution)
        # Format: .../user_id/filename.ext
        url_parts = request.audio_url.split('/')
        user_id = None
        for i, part in enumerate(url_parts):
            if part == "audio-files" and i + 1 < len(url_parts):
                user_id = url_parts[i + 1]
                break
        
        if not user_id:
            user_id = "anonymous"  # Fallback
        
        logger.info(f"Extracted user_id: {user_id}")
        
        # Create Sieve file from URL
        file = sieve.File(url=request.audio_url)
        logger.info("Created Sieve file object")
        
        # Configure model based on quality and selected stems
        model = request.model
        two_stems = request.two_stems
        
        # If specific stems are selected and it's just one, use two_stems mode
        if request.selected_stems and len(request.selected_stems) == 1:
            stem = request.selected_stems[0]
            if stem in ["vocals", "drums", "bass", "other", "guitar", "piano"]:
                two_stems = stem
                logger.info(f"Using two_stems mode for: {stem}")
        
        # Use 6-stem model if guitar or piano is requested
        if request.selected_stems and ("guitar" in request.selected_stems or "piano" in request.selected_stems):
            model = "htdemucs_6s"
            logger.info("Using htdemucs_6s model for guitar/piano separation")
        
        # Quality-based configuration
        if request.quality == "pro":
            if model == "htdemucs":
                model = "htdemucs_ft"
            overlap = 0.25
            shifts = 1
        else:
            overlap = request.overlap
            shifts = request.shifts
        
        logger.info(f"Final parameters: model={model}, two_stems={two_stems}, overlap={overlap}, shifts={shifts}")
        
        # Get Demucs function
        demucs = sieve.function.get("sieve/demucs")
        logger.info("Retrieved Demucs function")
        
        # Run separation synchronously
        logger.info("Starting synchronous separation...")
        result = demucs.run(
            file=file,
            model=model,
            two_stems=two_stems,
            overlap=overlap,
            shifts=shifts,
            audio_format=request.audio_format
        )
        
        logger.info("Separation completed successfully")
        logger.info(f"Result type: {type(result)}")
        logger.info(f"Result length: {len(result) if hasattr(result, '__len__') else 'N/A'}")
        
        # Process result - Upload to Supabase and get public URLs
        output_files = []
        local_files_to_cleanup = []
        
        if hasattr(result, '__iter__'):
            for i, output_file in enumerate(result):
                logger.info(f"Processing output file {i}: type={type(output_file)}")
                
                # Get local file path
                local_file_path = None
                if hasattr(output_file, 'path') and output_file.path:
                    local_file_path = output_file.path
                    logger.info(f"File path: {local_file_path}")
                
                if local_file_path and os.path.exists(local_file_path):
                    stem_name = get_stem_name(i, two_stems, model)
                    
                    # Upload to Supabase storage
                    public_url = await upload_file_to_supabase(local_file_path, stem_name, user_id)
                    
                    output_files.append({
                        "index": i,
                        "url": public_url,
                        "stem_name": stem_name
                    })
                    
                    # Mark for cleanup
                    local_files_to_cleanup.append(local_file_path)
                    
                    logger.info(f"Output file {i}: url={public_url}, stem={stem_name}")
                else:
                    logger.warning(f"Could not find local file for output {i}")
        else:
            logger.warning(f"Result is not iterable: {result}")
        
        # Clean up local temporary files
        for file_path in local_files_to_cleanup:
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up temporary file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up {file_path}: {e}")
        
        return {
            "status": "completed",
            "message": "Separation completed successfully",
            "output_files": output_files,
            "parameters": {
                "model": model,
                "two_stems": two_stems,
                "overlap": overlap,
                "shifts": shifts,
                "audio_format": request.audio_format
            }
        }
        
    except Exception as e:
        logger.error(f"Error during separation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to complete separation: {str(e)}")

def get_stem_name(index: int, two_stems: str, model: str) -> str:
    """Map output file index to stem name based on model and configuration"""
    if two_stems != "None":
        # Two-stem mode: first file is the selected stem, second is everything else
        if index == 0:
            return two_stems
        else:
            return f"no_{two_stems}"
    
    # Standard 4-stem mode
    stem_names_4 = ["vocals", "drums", "bass", "other"]
    
    # 6-stem mode 
    stem_names_6 = ["vocals", "drums", "bass", "other", "guitar", "piano"]
    
    if model == "htdemucs_6s":
        return stem_names_6[index] if index < len(stem_names_6) else f"stem_{index}"
    else:
        return stem_names_4[index] if index < len(stem_names_4) else f"stem_{index}"

@app.get("/status/{job_id}")
async def get_job_status(job_id: str) -> JobStatusResponse:
    """
    Get the status of a separation job (placeholder for future async implementation)
    """
    return JobStatusResponse(
        job_id=job_id,
        status="completed",
        result=None,
        error="Synchronous processing - no job tracking needed"
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "stemify-sieve-api"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port) 