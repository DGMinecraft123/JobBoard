#!/usr/bin/env python3
"""
Test script to verify the exact JSON that's failing
"""

import json
import re

def test_exact_json():
    """Test the exact JSON that's failing"""
    
    # The exact JSON that's failing
    test_json = '{"jobTitle": "Sous Chef", "companyName": "The Grandview Restaurant", "location": "San Jose, CA", "salaryRange": "$35/hr", "workSchedule": "", "contactInfo": "", "description": "This is a fantastic opportunity to lead as a Sous Chef at The Grandview Restaurant in San Jose. You\'ll be working alongside the esteemed Head Chef to oversee daily kitchen activities, manage a dynamic team, and uphold exceptional culinary standards. Expect to contribute to menu development, monitor food costs, and ensure adherence to stringent health and safety protocols. This role offers a competitive hourly wage of $35/hour.", "qualifications": "Proven track record as a Sous Chef or similar executive culinary position, Minimum of 3 years\' experience in a high-volume restaurant setting, Expertise in modern French cuisine, Proficiency in sous-vide techniques, Strong communication and team-building abilities, Demonstrated ability to manage budgets and control food costs"}'
    
    print("🧪 Testing exact JSON that's failing")
    print(f"🔍 JSON length: {len(test_json)}")
    print(f"🔍 First 100 chars: {repr(test_json[:100])}")
    print(f"🔍 Last 100 chars: {repr(test_json[-100:])}")
    
    # Check for any invisible characters
    print(f"🔍 Character codes: {[ord(c) for c in test_json[:20]]}")
    
    # Test direct parsing
    try:
        result = json.loads(test_json)
        print("✅ Direct JSON parsing successful!")
        print(f"Job Title: {result.get('jobTitle')}")
        print(f"Company: {result.get('companyName')}")
        return True
    except json.JSONDecodeError as e:
        print(f"❌ Direct JSON parsing failed: {e}")
        print(f"❌ Error position: {e.pos}")
        print(f"❌ Error line: {e.lineno}, column: {e.colno}")
        
        # Show the problematic area
        if e.pos < len(test_json):
            start = max(0, e.pos - 20)
            end = min(len(test_json), e.pos + 20)
            print(f"❌ Problem area: {repr(test_json[start:end])}")
    
    return False

def test_cleaned_json():
    """Test with various cleaning methods"""
    
    test_json = '{"jobTitle": "Sous Chef", "companyName": "The Grandview Restaurant", "location": "San Jose, CA", "salaryRange": "$35/hr", "workSchedule": "", "contactInfo": "", "description": "This is a fantastic opportunity to lead as a Sous Chef at The Grandview Restaurant in San Jose. You\'ll be working alongside the esteemed Head Chef to oversee daily kitchen activities, manage a dynamic team, and uphold exceptional culinary standards. Expect to contribute to menu development, monitor food costs, and ensure adherence to stringent health and safety protocols. This role offers a competitive hourly wage of $35/hour.", "qualifications": "Proven track record as a Sous Chef or similar executive culinary position, Minimum of 3 years\' experience in a high-volume restaurant setting, Expertise in modern French cuisine, Proficiency in sous-vide techniques, Strong communication and team-building abilities, Demonstrated ability to manage budgets and control food costs"}'
    
    print("\n🧹 Testing with cleaning methods:")
    
    # Method 1: Remove non-printable characters
    cleaned1 = ''.join(char for char in test_json if char.isprintable() or char in '\n\t')
    try:
        result = json.loads(cleaned1)
        print("✅ Method 1 (printable chars) successful!")
        return True
    except:
        print("❌ Method 1 failed")
    
    # Method 2: Remove quotes and re-add them
    cleaned2 = test_json.replace('"', '"').replace('"', '"')
    try:
        result = json.loads(cleaned2)
        print("✅ Method 2 (quote replacement) successful!")
        return True
    except:
        print("❌ Method 2 failed")
    
    # Method 3: Use regex extraction
    match = re.search(r'\{.*\}', test_json, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group())
            print("✅ Method 3 (regex extraction) successful!")
            return True
        except:
            print("❌ Method 3 failed")
    
    return False

if __name__ == "__main__":
    print("🔍 JSON Parsing Diagnostic")
    print("=" * 50)
    
    success1 = test_exact_json()
    success2 = test_cleaned_json()
    
    if success1 or success2:
        print("\n🎉 At least one method worked!")
    else:
        print("\n💥 All methods failed!") 