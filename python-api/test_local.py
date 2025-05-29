#!/usr/bin/env python3
"""
Test script for the Stemify Sieve API service
Run this to test the service locally before deployment
"""

import requests
import json
import time

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_AUDIO_URL = "https://wqzretaqqqtzxdtoljqr.supabase.co/storage/v1/object/public/audio-files/dd0d269e-2931-451c-9404-038a01cd0149/4d86850c-6ab1-44b6-96bc-ec614956bb41.mp3"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_root_endpoint():
    """Test the root endpoint"""
    print("\n🔍 Testing root endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Root endpoint passed")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Root endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Root endpoint error: {e}")
        return False

def test_separation_endpoint():
    """Test the separation endpoint"""
    print("\n🔍 Testing separation endpoint...")
    
    payload = {
        "audio_url": TEST_AUDIO_URL,
        "model": "htdemucs",
        "two_stems": "None",
        "overlap": 0.1,
        "shifts": 0,
        "audio_format": "wav",
        "selected_stems": ["vocals", "drums", "bass", "other"],
        "quality": "standard"
    }
    
    try:
        print(f"   Sending request with payload: {json.dumps(payload, indent=2)}")
        response = requests.post(
            f"{BASE_URL}/separate",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Separation endpoint passed")
            print(f"   Response: {json.dumps(result, indent=2)}")
            return True, result.get('job_id')
        else:
            print(f"❌ Separation endpoint failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False, None
    except Exception as e:
        print(f"❌ Separation endpoint error: {e}")
        return False, None

def test_status_endpoint(job_id):
    """Test the status endpoint"""
    if not job_id:
        print("\n⏭️  Skipping status test (no job ID)")
        return False
        
    print(f"\n🔍 Testing status endpoint for job: {job_id}")
    try:
        response = requests.get(f"{BASE_URL}/status/{job_id}")
        if response.status_code == 200:
            result = response.json()
            print("✅ Status endpoint passed")
            print(f"   Response: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Status endpoint failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Status endpoint error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Stemify Sieve API tests...\n")
    
    # Test basic endpoints
    health_ok = test_health_check()
    root_ok = test_root_endpoint()
    
    if not (health_ok and root_ok):
        print("\n❌ Basic endpoint tests failed. Make sure the service is running.")
        print("   Start with: uvicorn main:app --reload")
        return
    
    # Test separation endpoint
    separation_ok, job_id = test_separation_endpoint()
    
    if separation_ok and job_id:
        # Test status endpoint
        test_status_endpoint(job_id)
    
    print("\n🏁 Tests completed!")
    
    if health_ok and root_ok and separation_ok:
        print("✅ All tests passed! The service is ready for deployment.")
    else:
        print("❌ Some tests failed. Check the logs above.")

if __name__ == "__main__":
    main() 