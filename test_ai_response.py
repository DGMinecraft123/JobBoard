#!/usr/bin/env python3
"""
Test script to see the actual AI response from the segmentation service
"""

import requests
import json

def test_ai_response():
    """Test the actual AI response from the segmentation service"""
    
    # Test job description
    test_description = "This is a fantastic opportunity to lead as a Sous Chef at The Grandview Restaurant in San Jose. You'll be working alongside the esteemed Head Chef to oversee daily kitchen activities, manage a dynamic team, and uphold exceptional culinary standards. Expect to contribute to menu development, monitor food costs, and ensure adherence to stringent health and safety protocols. This role offers a competitive hourly wage of $35/hour."
    
    print("🧪 Testing AI response from segmentation service")
    print(f"📝 Job description: {test_description[:100]}...")
    
    try:
        # Call the segmentation endpoint
        response = requests.post(
            'http://127.0.0.1:8001/segment',
            headers={'Content-Type': 'application/json'},
            json={'description': test_description},
            timeout=30
        )
        
        print(f"📡 Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success response: {json.dumps(result, indent=2)}")
            
            if result.get('success') and result.get('data'):
                data = result['data']
                print(f"🎯 Extracted job title: {data.get('jobTitle')}")
                print(f"🏢 Extracted company: {data.get('companyName')}")
                print(f"📍 Extracted location: {data.get('location')}")
                print(f"💰 Extracted salary: {data.get('salaryRange')}")
            else:
                print(f"❌ Response indicates failure: {result}")
        else:
            print(f"❌ Error response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        print(f"📄 Raw response: {response.text}")

if __name__ == "__main__":
    test_ai_response() 