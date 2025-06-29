#!/usr/bin/env python3
"""
Test script to verify JSON parsing with the exact response that's failing
"""

import json
import re

def test_json_parsing():
    """Test the JSON parsing with the exact response"""
    
    # The exact response that's failing
    test_response = '{"jobTitle": "Sous Chef", "companyName": "The Grandview Restaurant", "location": "San Jose, CA", "salaryRange": "$35/hr", "workSchedule": "", "contactInfo": "", "description": "This is a fantastic opportunity to be a key member of the culinary team at The Grandview Restaurant as the Sous Chef. You\'ll work closely with the Head Chef to oversee daily kitchen activities, manage staff, and uphold exceptional food quality standards. Your responsibilities will encompass menu development, precise food cost control, and ensuring a secure and efficient working environment. This role requires a solid foundation in culinary arts, extensive experience in a professional kitchen setting, and a proven track record of leading teams effectively.", "qualifications": "Culinary diploma or comparable expertise, Minimum of 3 years in professional kitchen, Food safety certification, Excellent leadership abilities, Experience in menu creation, Proficiency in food cost administration"}'
    
    print("🧪 Testing JSON parsing with exact response")
    print(f"🔍 Raw response: {repr(test_response)}")
    
    # Test direct JSON parsing
    try:
        result = json.loads(test_response)
        print("✅ Direct JSON parsing successful!")
        print(f"Job Title: {result.get('jobTitle')}")
        print(f"Company: {result.get('companyName')}")
        return True
    except json.JSONDecodeError as e:
        print(f"❌ Direct JSON parsing failed: {e}")
    
    # Test the same parsing logic as in the model
    try:
        # Clean up the response - remove any markdown formatting
        clean_text = re.sub(r'```json\n?|\n?```', '', test_response).strip()
        
        # Remove any leading/trailing text that's not JSON
        clean_text = re.sub(r'^[^{]*', '', clean_text)
        clean_text = re.sub(r'[^}]*$', '', clean_text)
        
        # Remove any extra whitespace and newlines
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        
        print(f"🧹 Cleaned text: {repr(clean_text)}")
        
        # Try to find JSON in the response using regex
        json_match = re.search(r'\{.*\}', clean_text, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            print(f"📋 Regex extracted JSON: {repr(json_str)}")
            result = json.loads(json_str)
            print("✅ Regex extraction successful!")
            return True
        
        # Try parsing the entire cleaned text
        result = json.loads(clean_text)
        print("✅ Cleaned text parsing successful!")
        return True
        
    except Exception as e:
        print(f"❌ All parsing attempts failed: {e}")
        return False

if __name__ == "__main__":
    success = test_json_parsing()
    if success:
        print("\n🎉 JSON parsing test passed!")
    else:
        print("\n💥 JSON parsing test failed!") 