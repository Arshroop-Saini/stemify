#!/usr/bin/env python3
"""
Test script to verify Sieve API integration
"""
import os
import sys

# Add current directory to path to import sieve
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set Sieve API key (same as in api/separate.py)
SIEVE_API_KEY = "AXJHjLPemWHBSEsx2z254isQFSiCA7iQt2g8aSbYbZk"
os.environ['SIEVE_API_KEY'] = SIEVE_API_KEY

try:
    import sieve
    print("✅ Sieve module imported successfully")
    
    # Test API key
    api_key = os.getenv('SIEVE_API_KEY')
    if api_key:
        print(f"✅ Sieve API key found: {api_key[:10]}...")
    else:
        print("❌ No Sieve API key found in environment")
        sys.exit(1)
    
    # Test getting the Demucs function
    try:
        demucs = sieve.function.get("sieve/demucs")
        print("✅ Sieve Demucs function accessed successfully")
        print(f"Function info: {demucs}")
    except Exception as e:
        print(f"❌ Error accessing Sieve Demucs function: {e}")
        sys.exit(1)
    
    print("\n🎉 All Sieve API tests passed!")
    print("Ready to process audio separation jobs.")
    
except ImportError as e:
    print(f"❌ Failed to import sieve: {e}")
    print("Install with: pip install sievedata")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    sys.exit(1) 