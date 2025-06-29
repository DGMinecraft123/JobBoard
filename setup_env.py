#!/usr/bin/env python3
"""
Environment Setup Script for JobBoard AI Services
This script helps you set up the required environment variables for IBM WatsonX AI services.
"""

import os
import sys

def create_env_file():
    """Create a .env file with the required environment variables"""
    
    print("🔧 JobBoard AI Services Environment Setup")
    print("=" * 50)
    print()
    print("This script will help you set up the required environment variables.")
    print("You'll need your IBM WatsonX AI API key and Project ID.")
    print()
    print("To get these credentials:")
    print("1. Go to https://cloud.ibm.com/")
    print("2. Navigate to WatsonX AI")
    print("3. Create a new project or use an existing one")
    print("4. Get your API key and Project ID")
    print()
    
    # Get API key
    api_key = input("Enter your IBM WatsonX AI API Key: ").strip()
    if not api_key:
        print("❌ API Key is required!")
        return False
    
    # Get Project ID
    project_id = input("Enter your IBM WatsonX AI Project ID: ").strip()
    if not project_id:
        print("❌ Project ID is required!")
        return False
    
    # Get region (optional)
    region = input("Enter your IBM region (default: us-south): ").strip()
    if not region:
        region = "us-south"
    
    # Create .env content
    env_content = f"""# IBM WatsonX AI Configuration
VITE_IBM_API_KEY={api_key}
VITE_IBM_PROJECT_ID={project_id}
VITE_IBM_REGION={region}

# Database Configuration (update these with your actual values)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=jobboard

# JWT Secret (change this in production)
JWT_SECRET=your-secret-key-change-this-in-production

# Server Port
PORT=3001
"""
    
    # Write to .env file
    try:
        with open('.env', 'w') as f:
            f.write(env_content)
        print()
        print("✅ .env file created successfully!")
        print()
        print("📋 Environment variables set:")
        print(f"   VITE_IBM_API_KEY: {'*' * (len(api_key) - 4) + api_key[-4:] if len(api_key) > 4 else '*' * len(api_key)}")
        print(f"   VITE_IBM_PROJECT_ID: {project_id}")
        print(f"   VITE_IBM_REGION: {region}")
        print()
        print("🚀 You can now start the services:")
        print("   1. python model.py (for AI services)")
        print("   2. npm run dev (for the web app)")
        print()
        return True
        
    except Exception as e:
        print(f"❌ Error creating .env file: {e}")
        return False

def check_env_file():
    """Check if .env file exists and has required variables"""
    if not os.path.exists('.env'):
        print("❌ .env file not found!")
        return False
    
    # Load environment variables
    with open('.env', 'r') as f:
        content = f.read()
    
    required_vars = ['VITE_IBM_API_KEY', 'VITE_IBM_PROJECT_ID']
    missing_vars = []
    
    for var in required_vars:
        if f'{var}=' not in content:
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    print("✅ .env file exists and has required variables")
    return True

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == '--check':
        check_env_file()
    else:
        if os.path.exists('.env'):
            print("⚠️  .env file already exists!")
            overwrite = input("Do you want to overwrite it? (y/N): ").strip().lower()
            if overwrite != 'y':
                print("Setup cancelled.")
                return
        
        create_env_file()

if __name__ == "__main__":
    main() 