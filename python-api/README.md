# Stemify Sieve API Service

This is a Python FastAPI service that provides a REST API interface to the Sieve Demucs model for audio source separation. Since Sieve only provides a Python SDK, this service acts as a bridge between our Next.js frontend and the Sieve platform.

## Features

- 🎵 Audio source separation using Sieve's Demucs models
- 🚀 FastAPI with async support
- 📊 Job status tracking
- 🔧 Configurable quality settings
- 🎛️ Support for multiple stem configurations

## Setup

### Prerequisites

- Python 3.8+
- Sieve account and API access

### Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Authenticate with Sieve:**
   ```bash
   sieve login
   ```
   Follow the prompts to authenticate with your Sieve account.

3. **Run the service:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Testing

Run the test script to verify everything works:

```bash
python test_local.py
```

This will test all endpoints and verify the Sieve integration.

## API Endpoints

### `POST /separate`

Start an audio separation job.

**Request Body:**
```json
{
  "audio_url": "https://example.com/audio.mp3",
  "model": "htdemucs_ft",
  "two_stems": "None",
  "overlap": 0.25,
  "shifts": 0,
  "audio_format": "wav",
  "selected_stems": ["vocals", "drums", "bass", "other"],
  "quality": "standard"
}
```

**Response:**
```json
{
  "job_id": "sieve-job-id-123",
  "status": "processing",
  "message": "Separation job started successfully",
  "parameters": {
    "model": "htdemucs_ft",
    "two_stems": "None",
    "overlap": 0.25,
    "shifts": 0,
    "audio_format": "wav"
  }
}
```

### `GET /status/{job_id}`

Get the status of a separation job.

**Response:**
```json
{
  "job_id": "sieve-job-id-123",
  "status": "completed",
  "result": [...],
  "error": null
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "stemify-sieve-api"
}
```

## Configuration

### Quality Settings

- **Standard**: Fast processing with good quality
  - Model: `htdemucs`
  - Overlap: 0.1
  - Shifts: 0

- **Pro**: Slower processing with better quality
  - Model: `htdemucs_ft`
  - Overlap: 0.25
  - Shifts: 1

### Stem Configurations

- **4 stems**: vocals, drums, bass, other (default models)
- **6 stems**: vocals, drums, bass, other, guitar, piano (htdemucs_6s)
- **2 stems**: selected stem + everything else (two_stems mode)

## Deployment

### Railway

1. **Connect your repository to Railway**
2. **Set environment variables** (if needed)
3. **Deploy** - Railway will automatically detect the `railway.toml` configuration

The service will be available at your Railway-provided URL.

### Other Platforms

The service can be deployed to any platform that supports Python applications:

- **Render**: Use the `requirements.txt` and start command
- **Heroku**: Add a `Procfile` with the uvicorn command
- **Google Cloud Run**: Use the provided configuration
- **AWS Lambda**: With appropriate serverless framework setup

### Environment Variables

Set these in your deployment platform:

- `PORT`: Port to run the service on (default: 8000)
- Any Sieve-specific configuration if needed

## Integration with Next.js

Update your Next.js environment variables:

```env
PYTHON_API_URL=https://your-deployed-service.railway.app
```

The Next.js API route will automatically call this service for audio separation.

## Troubleshooting

### Common Issues

1. **Sieve authentication errors**
   - Make sure you've run `sieve login` and authenticated
   - Check that your Sieve account has sufficient credits

2. **File access errors**
   - Ensure the audio URL is publicly accessible
   - Check that the file format is supported (mp3, wav, flac)

3. **Timeout errors**
   - Large files may take longer to process
   - Consider increasing timeout values in your deployment

### Logs

The service provides detailed logging. Check the logs for:
- Sieve API calls and responses
- File processing status
- Error details

## Development

### Local Development

1. Start the service:
   ```bash
   uvicorn main:app --reload
   ```

2. Test with the provided script:
   ```bash
   python test_local.py
   ```

3. Access the interactive API docs at: `http://localhost:8000/docs`

### Adding Features

- Modify `main.py` to add new endpoints
- Update the Pydantic models for new request/response formats
- Add tests to `test_local.py`

## License

This service is part of the Stemify project. 