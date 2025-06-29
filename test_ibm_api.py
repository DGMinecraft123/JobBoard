#!/usr/bin/env python3
"""
Test script to verify IBM WatsonX AI API credentials
"""

import os
import requests
from dotenv import load_dotenv

def test_ibm_api():
    """Test the IBM WatsonX AI API with the configured credentials"""
    
    # Load environment variables
    load_dotenv()
    
    api_key = os.getenv("VITE_IBM_API_KEY")
    if not api_key:
        print("❌ VITE_IBM_API_KEY not found in environment variables")
        print("Please check your .env file")
        return False
    
    print("🔍 Testing IBM WatsonX AI API...")
    print(f"API Key: {'*' * (len(api_key) - 4) + api_key[-4:] if len(api_key) > 4 else '*' * len(api_key)}")
    
    # Test endpoint
    url = "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    }
    
    payload = {
        "model_id": "meta-llama/llama-2-70b-chat",
        "parameters": {
            "max_new_tokens": 50,
            "temperature": 0.1,
            "top_p": 0.9,
            "repetition_penalty": 1.1
        },
        "prompt": "Say 'Hello, API test successful!'"
    }
    
    try:
        print("📡 Making test API call...")
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            generated_text = result.get('results', [{}])[0].get('generated_text', '')
            print("✅ API test successful!")
            print(f"Response: {generated_text}")
            return True
        else:
            print(f"❌ API test failed with status {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ API test failed with exception: {e}")
        return False

def test_job_segmentation():
    """Test the job segmentation endpoint"""
    
    print("\n🔍 Testing job segmentation endpoint...")
    
    try:
        response = requests.post(
            'http://127.0.0.1:8001/segment',
            headers={'Content-Type': 'application/json'},
            json={'description': 'Sous chef opportunity: The Grandview Restaurant, San Jose, $35/hr'},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Job segmentation test successful!")
                print(f"Extracted data: {result.get('data', {})}")
                return True
            else:
                print(f"❌ Job segmentation failed: {result.get('message', 'Unknown error')}")
                return False
        else:
            print(f"❌ Job segmentation test failed with status {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Job segmentation test failed with exception: {e}")
        return False

if __name__ == "__main__":
    print("🧪 IBM WatsonX AI API Test Suite")
    print("=" * 40)
    
    # Test direct API
    api_success = test_ibm_api()
    
    if api_success:
        print("\n" + "=" * 40)
        # Test job segmentation endpoint
        test_job_segmentation()
    
    print("\n" + "=" * 40)
    if api_success:
        print("🎉 All tests passed! Your IBM API is working correctly.")
    else:
        print("💡 To fix API issues:")
        print("1. Run: python setup_env.py")
        print("2. Get valid credentials from https://cloud.ibm.com/")
        print("3. Make sure your IBM WatsonX AI project is active") 