from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
import asyncio
from concurrent.futures import ThreadPoolExecutor
import re
import time
from collections import deque
from threading import Lock
import hashlib
import requests
import json
from typing import Optional

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Services API", description="Translation and Job Segmentation services using IBM WatsonX")

# Global model instance (loaded once at startup)
model_inference = None
granite_service = None
executor = ThreadPoolExecutor(max_workers=4)

# Translation cache
class TranslationCache:
    def __init__(self, max_size: int = 1000):
        self.cache = {}
        self.max_size = max_size
        self.lock = Lock()
    
    def _get_cache_key(self, text: str, from_language: str, to_language: str) -> str:
        """Generate a cache key for the translation request"""
        key_string = f"{text.lower().strip()}:{from_language.lower()}:{to_language.lower()}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def get(self, text: str, from_language: str, to_language: str) -> str | None:
        """Get cached translation if available"""
        with self.lock:
            cache_key = self._get_cache_key(text, from_language, to_language)
            return self.cache.get(cache_key)
    
    def set(self, text: str, from_language: str, to_language: str, translation: str):
        """Cache a translation"""
        with self.lock:
            cache_key = self._get_cache_key(text, from_language, to_language)
            
            # If cache is full, remove oldest entry (simple FIFO)
            if len(self.cache) >= self.max_size:
                # Remove first item (oldest)
                self.cache.pop(next(iter(self.cache)))
            
            self.cache[cache_key] = translation
    
    def clear(self):
        """Clear the cache"""
        with self.lock:
            self.cache.clear()
    
    def size(self) -> int:
        """Get current cache size"""
        with self.lock:
            return len(self.cache)

# Global translation cache
translation_cache = TranslationCache(max_size=1000)

# Rate limiting for IBM WatsonX AI (2 requests per second)
class RateLimiter:
    def __init__(self, max_requests: int = 2, time_window: float = 1.0):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()
        self.lock = Lock()
    
    def can_make_request(self) -> bool:
        with self.lock:
            now = time.time()
            # Remove old requests outside the time window
            while self.requests and now - self.requests[0] > self.time_window:
                self.requests.popleft()
            
            return len(self.requests) < self.max_requests
    
    def record_request(self):
        with self.lock:
            self.requests.append(time.time())
    
    def wait_if_needed(self):
        while not self.can_make_request():
            time.sleep(0.1)  # Wait 100ms before checking again
        self.record_request()

# Global rate limiter
rate_limiter = RateLimiter(max_requests=2, time_window=1.0)

class TranslationRequest(BaseModel):
    text: str
    fromLanguage: str
    toLanguage: str

class TranslationResponse(BaseModel):
    success: bool
    originalText: str
    translatedText: str
    fromLanguage: str
    toLanguage: str
    cached: bool = False

# Job Segmentation Models
class JobSegmentationRequest(BaseModel):
    description: str

class JobSegments(BaseModel):
    jobTitle: Optional[str] = None
    companyName: Optional[str] = None
    location: Optional[str] = None
    salaryRange: Optional[str] = None
    workSchedule: Optional[str] = None
    contactInfo: Optional[str] = None
    description: Optional[str] = None
    qualifications: Optional[str] = None

class JobSegmentationResponse(BaseModel):
    success: bool
    data: JobSegments
    message: Optional[str] = None

class WatsonXAI:
    def __init__(self, api_key: str, project_id: str, region: str = "us-south"):
        self.api_key = api_key
        self.project_id = project_id
        self.region = region
        
        # Create credentials
        self.credentials = Credentials(
            url=f"https://{region}.ml.cloud.ibm.com",
            api_key=api_key
        )
        
        # Initialize the API client
        self.client = APIClient(self.credentials)
        
        # Initialize the model inference with project_id - using 3.2B natural language model for translation
        self.model_inference = ModelInference(
            model_id="ibm/granite-3-2b-instruct",  # 3.2B parameter IBM natural language model
            credentials={
                "apikey": api_key,
                "url": f"https://{region}.ml.cloud.ibm.com"
            },
            project_id=project_id
        )
    
    def translate_text(self, text: str, from_language: str, to_language: str) -> str:
        """Translate text using the loaded model"""
        # Check cache first
        cached_translation = translation_cache.get(text, from_language, to_language)
        if cached_translation:
            return cached_translation
        
        max_retries = 3
        retry_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                # Wait if needed to respect the rate limit
                rate_limiter.wait_if_needed()
                
                prompt = (
                    f"Translate this exact text to {to_language}. Do not add any words, do not complete sentences, do not explain anything.\n"
                    f"Input: {text}\n"
                    f"Translation:"
                )
                
                # Generate response using the model inference with optimized parameters for speed
                response = self.model_inference.generate(
                    prompt=prompt,
                    params={
                        "max_new_tokens": 300,  # Increased for longer translations
                        "min_new_tokens": 1,
                        "temperature": 0.05,    # Even lower temperature for more deterministic output
                        "top_p": 0.8,           # Lower for more focused output
                        "repetition_penalty": 1.1
                    }
                )
                
                # Extract the translated text
                if isinstance(response, dict) and 'results' in response:
                    raw_text = response['results'][0]['generated_text']
                else:
                    raw_text = str(response)
                
                # Clean the output: remove quotes, intro text, and extra whitespace
                cleaned_text = raw_text.strip()
                
                # Remove intro phrases like "Here is the translation:", "Translation:", etc.
                intro_patterns = [
                    r'^[^\w]*Here is the translation:?\s*',
                    r'^[^\w]*Translation:?\s*',
                    r'^[^\w]*The translation is:?\s*',
                    r'^[^\w]*Translated:?\s*',
                    r'^[^\w]*Result:?\s*',
                    r'^[^\w]*Output:?\s*',
                    r'^[^\w]*Input:?\s*',
                    r'^[^\w]*English:?\s*',
                    r'^[^\w]*French:?\s*',
                    r'^[^\w]*Spanish:?\s*',
                    r'^[^\w]*German:?\s*',
                    r'^[^\w]*Italian:?\s*',
                    r'^[^\w]*Portuguese:?\s*',
                    r'^[^\w]*Russian:?\s*',
                    r'^[^\w]*Chinese:?\s*',
                    r'^[^\w]*Japanese:?\s*',
                    r'^[^\w]*Korean:?\s*',
                    r'^[^\w]*Arabic:?\s*',
                    r'^[^\w]*Hindi:?\s*',
                    r'^[^\w]*Bengali:?\s*',
                    r'^[^\w]*Urdu:?\s*',
                    r'^[^\w]*Turkish:?\s*',
                    r'^[^\w]*Dutch:?\s*',
                    r'^[^\w]*Swedish:?\s*',
                    r'^[^\w]*Norwegian:?\s*',
                    r'^[^\w]*Danish:?\s*',
                    r'^[^\w]*Finnish:?\s*',
                    r'^[^\w]*Polish:?\s*',
                    r'^[^\w]*Czech:?\s*',
                    r'^[^\w]*Hungarian:?\s*',
                    r'^[^\w]*Greek:?\s*',
                    r'^[^\w]*Hebrew:?\s*',
                    r'^[^\w]*Thai:?\s*',
                    r'^[^\w]*Vietnamese:?\s*'
                ]
                
                for pattern in intro_patterns:
                    cleaned_text = re.sub(pattern, '', cleaned_text, flags=re.IGNORECASE)
                
                # Remove leading/trailing quotes (single and double)
                cleaned_text = re.sub(r'^["\']+|["\']+$', '', cleaned_text)
                
                # Remove any remaining quotes around the text
                cleaned_text = re.sub(r'^["\'](.+)["\']$', r'\1', cleaned_text)
                
                # Remove any text after newlines (stop at first line break)
                cleaned_text = cleaned_text.split('\n')[0]
                
                # Final cleanup
                cleaned_text = cleaned_text.strip()
                
                # Cache the successful translation
                translation_cache.set(text, from_language, to_language, cleaned_text)
                
                return cleaned_text
                    
            except Exception as e:
                error_str = str(e)
                
                # Check if it's a rate limit error
                if "429" in error_str or "rate_limit" in error_str.lower():
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        continue
                    else:
                        return f"Error: Rate limit exceeded. Please try again in a moment."
                
                # For other errors, return the error message
                return f"Error: {error_str}"
        
        return f"Error: Translation failed after {max_retries} attempts"

    def segment_job_description(self, description: str) -> JobSegments:
        """Segment job description using the same model"""
        try:
            # Wait if needed to respect the rate limit
            rate_limiter.wait_if_needed()
            
            prompt = f"""You are a job description analyzer. Extract information from this job description and return ONLY a JSON object. Do not include any other text, explanations, or formatting.

Job Description: "{description}"

Extract these fields into a JSON object:
- jobTitle: The job position/role
- companyName: The business/company name  
- location: The work location (city, state format)
- salaryRange: The salary/wage with currency and period
- workSchedule: Work days and hours (if mentioned)
- contactInfo: Contact person (if mentioned)
- description: A professional job description (create one if not provided)
- qualifications: Required skills and experience (create comprehensive list if not provided)

Rules:
- For location, use "City, State" format, ignore street addresses
- For salary, include currency symbol and period (e.g., "$35/hr", "$50,000/year")
- For company names, preserve "The" if present
- Extract only the job title, not surrounding words like "opportunity" or "position"
- If description is missing or minimal, create a professional job description based on the job title
- If qualifications are missing, create a comprehensive list of relevant skills and experience for the role
- Make descriptions engaging and professional
- Include typical responsibilities and expectations for the role

IMPORTANT: Return ONLY the JSON object. Do not include any text before or after the JSON. Do not use markdown formatting.

Example output format:
{{"jobTitle": "Sous Chef", "companyName": "The Grandview Restaurant", "location": "San Jose, CA", "salaryRange": "$35/hr", "workSchedule": "", "contactInfo": "", "description": "We are seeking an experienced Sous Chef to join our culinary team at The Grandview Restaurant. The ideal candidate will assist the Head Chef in managing kitchen operations, supervising staff, and ensuring high-quality food preparation. This role involves menu planning, food cost management, and maintaining kitchen safety standards.", "qualifications": "Culinary degree or equivalent experience, 3+ years in professional kitchen, Food safety certification, Strong leadership skills, Menu planning experience, Knowledge of food cost management"}}

Return the JSON object:"""

            print(f"🤖 Sending prompt to AI model...")
            
            # Generate response using the model inference
            response = self.model_inference.generate(
                prompt=prompt,
                params={
                    "max_new_tokens": 800,  # Increased for longer descriptions
                    "min_new_tokens": 1,
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "repetition_penalty": 1.1
                }
            )
            
            print(f"📥 Raw model response type: {type(response)}")
            print(f"📥 Raw model response: {response}")
            
            # Extract the generated text
            if isinstance(response, dict) and 'results' in response:
                generated_text = response['results'][0]['generated_text']
                print(f"📋 Extracted from results: {repr(generated_text)}")
            else:
                generated_text = str(response)
                print(f"📋 Converted to string: {repr(generated_text)}")
            
            if not generated_text:
                raise Exception("No generated text in response")
            
            # Parse the JSON response
            try:
                parsed_data = self.parse_ai_response(generated_text)
            except Exception as parse_error:
                print(f"⚠️ JSON parsing failed, creating fallback response: {parse_error}")
                # Create a fallback response based on the job description
                parsed_data = {
                    "jobTitle": "Job Position",
                    "companyName": "Company",
                    "location": "Location",
                    "salaryRange": "Salary TBD",
                    "workSchedule": "",
                    "contactInfo": "",
                    "description": f"We are seeking a qualified candidate for this position. {description}",
                    "qualifications": "Experience in relevant field, Strong communication skills, Team player"
                }
            
            # Capitalize company name if it exists
            if parsed_data.get('companyName'):
                parsed_data['companyName'] = self.capitalize_company_name(parsed_data['companyName'])
            
            return JobSegments(**parsed_data)
            
        except Exception as e:
            print(f"Error in job segmentation: {e}")
            raise e
    
    def parse_ai_response(self, response_text: str) -> dict:
        """Parse the AI response and extract JSON"""
        try:
            print(f"🔍 Raw AI response: {repr(response_text)}")
            
            # Method 1: Try direct JSON parsing first
            try:
                result = json.loads(response_text.strip())
                print(f"✅ Direct JSON parsing successful")
                return result
            except json.JSONDecodeError:
                print(f"❌ Direct parsing failed, trying cleaning methods...")
            
            # Method 2: Clean up the response - remove any markdown formatting
            clean_text = re.sub(r'```json\n?|\n?```', '', response_text).strip()
            
            # Method 3: Remove any leading/trailing text that's not JSON
            # Find the first occurrence of { and last occurrence of }
            start_idx = clean_text.find('{')
            end_idx = clean_text.rfind('}')
            
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = clean_text[start_idx:end_idx + 1]
                print(f"📋 Extracted JSON: {repr(json_str)}")
                try:
                    result = json.loads(json_str)
                    print(f"✅ Successfully parsed JSON from extraction")
                    return result
                except json.JSONDecodeError as e:
                    print(f"❌ Extraction parsing failed: {e}")
            
            # Method 4: Try regex extraction with more patterns
            json_patterns = [
                r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',  # Nested JSON
                r'\{.*?\}',  # Simple JSON
                r'\{[^}]*\}',  # Basic JSON
            ]
            
            for pattern in json_patterns:
                matches = re.findall(pattern, clean_text, re.DOTALL)
                for match in matches:
                    print(f"📋 Regex pattern '{pattern}' found: {repr(match)}")
                    try:
                        result = json.loads(match)
                        print(f"✅ Successfully parsed JSON from regex pattern '{pattern}'")
                        return result
                    except json.JSONDecodeError:
                        continue
            
            # Method 5: Remove any potential invisible characters and try again
            try:
                # Remove any non-printable characters except newlines and tabs
                cleaned_json = ''.join(char for char in clean_text if char.isprintable() or char in '\n\t')
                # Try to extract JSON from cleaned text
                start_idx = cleaned_json.find('{')
                end_idx = cleaned_json.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    json_str = cleaned_json[start_idx:end_idx + 1]
                    result = json.loads(json_str)
                    print(f"✅ Successfully parsed JSON after character cleaning")
                    return result
            except json.JSONDecodeError as e:
                print(f"❌ Character cleaning failed: {e}")
            
            # Method 6: Try to fix common JSON issues
            try:
                # Replace smart quotes with regular quotes
                fixed_text = clean_text.replace('"', '"').replace('"', '"')
                # Replace single quotes with double quotes for JSON keys
                fixed_text = re.sub(r"'([^']+)':", r'"\1":', fixed_text)
                # Try to extract JSON from fixed text
                start_idx = fixed_text.find('{')
                end_idx = fixed_text.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    json_str = fixed_text[start_idx:end_idx + 1]
                    result = json.loads(json_str)
                    print(f"✅ Successfully parsed JSON after quote fixing")
                    return result
            except json.JSONDecodeError as e:
                print(f"❌ Quote fixing failed: {e}")
            
            # If all parsing attempts fail, log the response and raise an error
            print(f"❌ All parsing attempts failed")
            print(f"Failed to parse AI response. Raw response: {response_text}")
            print(f"Cleaned response: {clean_text}")
            raise Exception("Could not extract valid JSON from AI response")
                
        except Exception as e:
            print(f"❌ Exception in parse_ai_response: {e}")
            print(f"Failed to parse AI response: {response_text}")
            raise Exception(f"Invalid JSON response from AI model: {e}")
    
    def capitalize_company_name(self, company_name: str) -> str:
        """Capitalize company name properly"""
        if not company_name:
            return company_name
            
        words = company_name.split()
        capitalized_words = []
        
        for i, word in enumerate(words):
            # Preserve "The" at the beginning
            if i == 0 and word.lower() == "the":
                capitalized_words.append("The")
            else:
                # Capitalize first letter, lowercase the rest
                capitalized_words.append(word.capitalize())
        
        return " ".join(capitalized_words)

# Initialize the model at startup
@app.on_event("startup")
async def startup_event():
    global model_inference, granite_service
    
    # Configuration
    API_KEY = os.getenv("VITE_IBM_API_KEY")
    PROJECT_ID = os.getenv("VITE_IBM_PROJECT_ID")
    REGION = os.getenv("VITE_IBM_REGION", "us-south")
    
    # Initialize WatsonXAI service for both translation and job segmentation
    if API_KEY and PROJECT_ID:
        try:
            watsonx = WatsonXAI(api_key=API_KEY, project_id=PROJECT_ID, region=REGION)
            model_inference = watsonx
            granite_service = watsonx  # Use the same instance for both services
            
            # Test the model
            test_result = model_inference.translate_text("Hello", "english", "spanish")
            print("Translation service initialized successfully")
            print("Job segmentation service initialized successfully")
            
        except Exception as e:
            print(f"Failed to initialize WatsonXAI service: {e}")
            model_inference = None
            granite_service = None
    else:
        print("WatsonXAI service not configured - missing API_KEY or PROJECT_ID")
        model_inference = None
        granite_service = None

@app.get("/")
async def root():
    return {
        "message": "AI Services API is running!", 
        "translation_service": model_inference is not None,
        "job_segmentation_service": granite_service is not None
    }

@app.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    if not model_inference:
        raise HTTPException(status_code=500, detail="Translation model not loaded")
    
    try:
        # Check cache first
        cached_translation = translation_cache.get(request.text, request.fromLanguage, request.toLanguage)
        if cached_translation:
            return TranslationResponse(
                success=True,
                originalText=request.text,
                translatedText=cached_translation,
                fromLanguage=request.fromLanguage,
                toLanguage=request.toLanguage,
                cached=True
            )
        
        # Wait if needed to respect the rate limit
        rate_limiter.wait_if_needed()
        
        # Run translation in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        translated_text = await loop.run_in_executor(
            executor, 
            model_inference.translate_text, 
            request.text, 
            request.fromLanguage, 
            request.toLanguage
        )
        
        return TranslationResponse(
            success=True,
            originalText=request.text,
            translatedText=translated_text,
            fromLanguage=request.fromLanguage,
            toLanguage=request.toLanguage,
            cached=False
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.post("/segment", response_model=JobSegmentationResponse)
async def segment_job_description(request: JobSegmentationRequest):
    """Segment job description using WatsonXAI"""
    try:
        if not request.description.strip():
            raise HTTPException(status_code=400, detail="Job description is required")
        
        if granite_service is None:
            # Return mock data for testing
            mock_response = JobSegments(
                jobTitle="Sample Job",
                companyName="Sample Company", 
                location="Sample Location",
                salaryRange="Sample Salary",
                workSchedule="",
                contactInfo="",
                description="This is a sample job description generated for testing purposes.",
                qualifications="Sample qualifications"
            )
            
            return JobSegmentationResponse(
                success=True,
                data=mock_response,
                message="Using mock data - WatsonXAI not configured"
            )
        
        # Use the WatsonXAI service for job segmentation
        segments = granite_service.segment_job_description(request.description)
        
        return JobSegmentationResponse(
            success=True,
            data=segments
        )
        
    except Exception as e:
        print(f"Error in segmentation endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "translation_service": model_inference is not None,
        "job_segmentation_service": granite_service is not None,
        "cache_size": translation_cache.size(),
        "timestamp": asyncio.get_event_loop().time()
    }

@app.post("/cache/clear")
async def clear_cache():
    """Clear the translation cache"""
    translation_cache.clear()
    return {"message": "Translation cache cleared", "cache_size": 0}

@app.get("/cache/stats")
async def cache_stats():
    """Get cache statistics"""
    return {
        "cache_size": translation_cache.size(),
        "max_size": translation_cache.max_size
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="error") 