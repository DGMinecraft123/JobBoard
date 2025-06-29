import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, DollarSign, Clock, Car, Bus, Building2, Users, Star, LogOut, ChevronDown, MessageSquare, Briefcase, Navigation, RefreshCw, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCurrentUser, logoutUser } from '@/lib/auth';
import { initializeRoutesAPI, getRoutesAPI } from '@/lib/routes-api';
import { Textarea } from '@/components/ui/textarea';

// Job post interface matching database schema
interface JobPost {
  jobpost_id: number;
  title: string;
  location: string;
  date: string;
  description: string;
  pictures_url: string;
  qualifications: string;
  salary: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  user_id?: number;
  name?: string;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

interface CommuteTimes {
  car: {
    time: string;
    distance: string;
    insights: string;
  };
  transit: {
    time: string;
    insights: string;
  };
  loading: boolean;
  error?: string;
}

interface CommuteCache {
  [key: string]: {
    car: {
      time: string;
      distance: string;
      insights: string;
    };
    transit: {
      time: string;
      insights: string;
    };
    timestamp: number;
  };
}

// Job segments interface
interface JobSegments {
  jobTitle?: string;
  companyName?: string;
  location?: string;
  salaryRange?: string;
  workSchedule?: string;
  contactInfo?: string;
  description?: string;
  qualifications?: string;
}

// User Avatar Component with proper initials generation
const UserAvatar = ({ 
  firstName, 
  lastName, 
  profilePictureUrl, 
  size = 40,
  className = ""
}: { 
  firstName: string; 
  lastName: string; 
  profilePictureUrl?: string; 
  size?: number;
  className?: string;
}) => {
  // Function to generate initials (first letter of first name + first letter of last name)
  const generateInitials = (first: string, last: string): string => {
    const firstInitial = first ? first.charAt(0).toUpperCase() : '';
    const lastInitial = last ? last.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial;
  };

  // Function to check if profile picture URL is valid
  const isValidProfilePicture = (url?: string): boolean => {
    if (!url) return false;
    // Check if it's a valid URL and not just text
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const initials = generateInitials(firstName, lastName);
  const hasValidPicture = isValidProfilePicture(profilePictureUrl);

  return (
    <div 
      className={`relative flex shrink-0 overflow-hidden rounded-full bg-blue-600 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {hasValidPicture ? (
        <img 
          src={profilePictureUrl} 
          alt={`${firstName} ${lastName}`}
          className="aspect-square h-full w-full object-cover"
          onError={(e) => {
            // Hide the image on error, fallback will show
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : null}
      
      {/* Always show initials as fallback or when no valid image */}
      <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600">
        <span className="text-white font-semibold" style={{ fontSize: `${Math.max(size * 0.4, 12)}px` }}>
          {initials}
        </span>
      </div>
    </div>
  );
};

const Index = () => {
  const [jobPosts, setJobPosts] = useState<JobPost[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPostJob, setShowPostJob] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobSalary, setJobSalary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [appliedJobs, setAppliedJobs] = useState<Set<number>>(new Set());
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [commuteTimes, setCommuteTimes] = useState<CommuteTimes>({
    car: { time: '', distance: '', insights: '' },
    transit: { time: '', insights: '' },
    loading: false
  });
  const [commuteCache, setCommuteCache] = useState<CommuteCache>({});
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
  const [departureDate, setDepartureDate] = useState<Date | undefined>(new Date());
  const [departureTime, setDepartureTime] = useState('16:00');
  const [trafficModel, setTrafficModel] = useState<'BEST_GUESS' | 'PESSIMISTIC' | 'OPTIMISTIC'>('BEST_GUESS');
  const [sortDate, setSortDate] = useState<'asc' | 'desc'>('desc');
  const [location, setLocation] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [workSchedule, setWorkSchedule] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedDescription, setExtractedDescription] = useState("");
  const [extractedQualifications, setExtractedQualifications] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const navigate = useNavigate();

  // Job segmentation function
  const segmentJobDescription = async (description: string): Promise<JobSegments> => {
    try {
      console.log('Calling job segmentation via backend proxy...');
      
      const response = await fetch('http://localhost:3001/api/granite/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend API error:', response.status, errorText);
        throw new Error(`Backend API responded with status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Backend API returned error');
      }

      console.log('AI segmentation successful:', result.data);
      return result.data;
      
    } catch (error) {
      console.error('Error calling job segmentation:', error);
      throw error;
    }
  };

  // Fetch job posts from database
  useEffect(() => {
    const fetchJobPosts = async () => {
      try {
        setLoading(true);
        
        // Build query parameters for sorting
        const params = new URLSearchParams();
        params.append('sortDate', sortDate);
        if (searchTerm) params.append('search', searchTerm);
        
        const response = await fetch(`http://localhost:3001/api/jobposts?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
          setJobPosts(result.data);
          // Don't set selectedJob here - we'll do it after filtering
        } else {
          setError('Failed to fetch job posts');
        }
      } catch (err) {
        setError('Error connecting to server');
        console.error('Error fetching job posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobPosts();
  }, [sortDate, searchTerm]);

  // Set selected job based on filtered results
  useEffect(() => {
    if (jobPosts.length > 0 && !selectedJob) {
      const filteredJobs = jobPosts.filter(job => job.user_id !== currentUser?.user_id);
      if (filteredJobs.length > 0) {
        // Check if there's a cached job post ID to restore
        const cachedJobPostId = localStorage.getItem('selectedJobPostId');
        if (cachedJobPostId) {
          console.log(`🔄 Attempting to restore cached job: ${cachedJobPostId}`);
          
          // First try to find the cached job in the filtered results (respecting search)
          let targetJob = filteredJobs.find(job => job.jobpost_id === parseInt(cachedJobPostId));
          
          if (!targetJob) {
            // If not found in filtered results, check if it exists in all jobs
            const allJobs = jobPosts.filter(job => job.user_id !== currentUser?.user_id);
            const cachedJobExists = allJobs.find(job => job.jobpost_id === parseInt(cachedJobPostId));
            
            if (cachedJobExists) {
              // The job exists but is filtered out by search, clear the cache
              console.log(`❌ Cached job ${cachedJobPostId} exists but is filtered out by search`);
              localStorage.removeItem('selectedJobPostId');
            } else {
              // The job doesn't exist anymore, clear the cache
              console.log(`❌ Cached job ${cachedJobPostId} no longer exists`);
              localStorage.removeItem('selectedJobPostId');
            }
          } else {
            // Found the cached job in filtered results, select it
            console.log(`✅ Successfully restored cached job: ${targetJob.title} (ID: ${targetJob.jobpost_id})`);
            setSelectedJob(targetJob);
            return;
          }
        }
        
        // Fall back to selecting the first job from filtered results
        console.log(`📋 No cached job found, selecting first job: ${filteredJobs[0].title}`);
        setSelectedJob(filteredJobs[0]);
      }
    }
  }, [jobPosts, currentUser?.user_id, selectedJob, searchTerm]);

  // Cache selected job when it changes
  useEffect(() => {
    if (selectedJob) {
      console.log(`💾 Caching selected job: ${selectedJob.title} (ID: ${selectedJob.jobpost_id})`);
      localStorage.setItem('selectedJobPostId', selectedJob.jobpost_id.toString());
    }
  }, [selectedJob]);

  // Fetch applied jobs for current user
  useEffect(() => {
    const fetchAppliedJobs = async () => {
      if (!currentUser?.user_id) return;
      
      try {
        const response = await fetch(`http://localhost:3001/api/applications/user/${currentUser.user_id}`);
        const result = await response.json();
        
        if (result.success) {
          const appliedJobIds = new Set<number>(Array.from(result.data, (app: { jobpost_id: number }) => app.jobpost_id));
          setAppliedJobs(appliedJobIds);
        }
      } catch (err) {
        console.error('Error fetching applied jobs:', err);
      }
    };

    fetchAppliedJobs();
  }, [currentUser?.user_id]);

  const handleSync = async () => {
    if (!jobDescription.trim()) return;
    
    setIsLoading(true);
    console.log('Starting job description segmentation with IBM Granite 3.3...');
    
    try {
      const segments: JobSegments = await segmentJobDescription(jobDescription);
      
      // Update form fields with segmented data
      setCompanyName(segments.companyName || "");
      setJobTitle(segments.jobTitle || "");
      setLocation(segments.location || "");
      setSalaryRange(segments.salaryRange || "");
      setContactInfo(segments.contactInfo || "");
      setWorkSchedule(segments.workSchedule || "");
      setExtractedDescription(segments.description || "");
      setExtractedQualifications(segments.qualifications || "");
      
      // Show preview after successful sync
      setShowPreview(true);
      
      // Show success feedback
      console.log('Form fields updated successfully with AI-extracted data');
      
    } catch (error) {
      console.error('Error segmenting job description:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostJob = async () => {
    if (!jobDescription.trim()) {
      console.log("Job description is required");
      return;
    }
    
    if (!jobTitle.trim()) {
      console.log("Job title is required");
      return;
    }
    
    if (!companyName.trim()) {
      console.log("Company name is required");
      return;
    }
    
    try {
      // Use current user's ID if authenticated, otherwise use default
      const userId = currentUser?.user_id || 1;
      
      // First, insert into jobpost table
      const jobpostResponse = await fetch('http://localhost:3001/api/jobposts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: jobTitle,
          name: companyName,
          location: location || 'Location TBD',
          description: extractedDescription || jobDescription,
          pictures_url: `jobpost/${userId}`, // Always use jobpost/{user_id}
          qualifications: extractedQualifications || 'To be determined',
          salary: salaryRange || 'Salary TBD',
          // date will be set to NOW() by the database
        }),
      });

      const jobpostResult = await jobpostResponse.json();
      if (jobpostResult.success) {
        const jobpostId = jobpostResult.data.jobpost_id; // Get the created jobpost_id
        
        // Then, insert into posts table to link user_id with jobpost_id
        const postsResponse = await fetch('http://localhost:3001/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            jobpost_id: jobpostId
          }),
        });

        const postsResult = await postsResponse.json();
        if (postsResult.success) {
          console.log('Job posted successfully with ID:', jobpostId);
          
          // Refresh job posts
          const refreshResponse = await fetch('http://localhost:3001/api/jobposts');
          const refreshResult = await refreshResponse.json();
          if (refreshResult.success) {
            setJobPosts(refreshResult.data);
          }
          
          // Reset form
          setJobDescription("");
          setCompanyName("");
          setJobTitle("");
          setLocation("");
          setSalaryRange("");
          setContactInfo("");
          setWorkSchedule("");
          setExtractedDescription("");
          setExtractedQualifications("");
          setShowPostJob(false);
        } else {
          setError('Failed to create post relationship');
        }
      } else {
        setError('Failed to post job');
      }
    } catch (err) {
      setError('Error posting job');
      console.error('Error posting job:', err);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    // Clear job cache on logout
    localStorage.removeItem('selectedJobPostId');
    navigate('/');
  };

  // Get user's location from IP address
  const getUserLocationFromIP = async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      // Use a free IP geolocation service
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        const address = `${data.city}, ${data.region}, ${data.country_name}`;
        
        setUserLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          address: address
        });
        
        // Store location in localStorage
        localStorage.setItem('userLocation', JSON.stringify({
          latitude: data.latitude,
          longitude: data.longitude,
          address: address
        }));
      } else {
        throw new Error('Unable to determine location from IP');
      }
    } catch (error) {
      console.error('Error getting location from IP:', error);
      setLocationError('Unable to determine your location automatically');
    } finally {
      setLocationLoading(false);
    }
  };

  // Load saved location from localStorage or get from IP
  useEffect(() => {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        setUserLocation(JSON.parse(savedLocation));
      } catch (error) {
        console.error('Error parsing saved location:', error);
        // If saved location is invalid, get from IP
        getUserLocationFromIP();
      }
    } else {
      // No saved location, get from IP
      getUserLocationFromIP();
    }
  }, []);

  // Load cached commute data from localStorage
  useEffect(() => {
    try {
      const savedCache = localStorage.getItem('commuteCache');
      if (savedCache) {
        const parsedCache = JSON.parse(savedCache);
        // Filter out expired cache entries (older than 1 hour)
        const now = Date.now();
        const cacheExpiry = 60 * 60 * 1000; // 1 hour in milliseconds
        
        const validCache: CommuteCache = {};
        Object.entries(parsedCache).forEach(([key, value]: [string, any]) => {
          if (now - value.timestamp < cacheExpiry) {
            validCache[key] = value;
          }
        });
        
        setCommuteCache(validCache);
      }
    } catch (error) {
      console.error('Error loading cached commute data:', error);
    }
  }, []);
  
  // Helper function to format departure date and time
  const formatDepartureDateTime = () => {
    if (!departureDate) return 'Not set';
    
    const date = departureDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long'
    });
    
    return `${date} at ${departureTime}`;
  };

  // Helper function to determine traffic level based on commute duration
  const getTrafficLevel = (durationSeconds: number, distanceMeters: number) => {
    const durationMinutes = durationSeconds / 60;
    const distanceKm = distanceMeters / 1000;
    const speedKmH = (distanceKm / durationMinutes) * 60;
    
    // Traffic level based on average speed
    if (speedKmH < 20) return 'Heavy Traffic';
    if (speedKmH < 40) return 'Moderate Traffic';
    return 'Light Traffic';
  };

  // Calculate commute times using Google Routes API with caching
  const calculateCommuteTimes = useCallback(async () => {
    if (!userLocation || !selectedJob) return;

    // Create a cache key based on origin, destination, departure time, and traffic model
    const originAddress = userLocation.address || `${userLocation.latitude},${userLocation.longitude}`;
    const destinationAddress = selectedJob.location;
    const departureKey = departureDate ? formatDepartureDateTime() : 'default';
    const cacheKey = `${originAddress}|${destinationAddress}|${departureKey}|${trafficModel}`;
    
    // Check cache first
    const cachedData = commuteCache[cacheKey];
    
    if (cachedData && Date.now() - cachedData.timestamp < 300000) { // 5 minutes cache
      setCommuteTimes({
        car: cachedData.car,
        transit: cachedData.transit,
        loading: false
      });
      return;
    }

    setCommuteTimes(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      // Initialize routes API
      const routesAPI = initializeRoutesAPI();

      let commuteData;
      
      // Use departure time if available, otherwise use current time
      if (departureDate) {
        const [hours, minutes] = departureTime.split(':').map(Number);
        const departureDateTime = new Date(departureDate);
        departureDateTime.setHours(hours, minutes, 0, 0);
        
        // Check if the departure time is in the past
        const now = new Date();
        if (departureDateTime <= now) {
          console.warn('Departure time is in the past, using current time instead');
          // Use current time + 5 minutes to ensure it's in the future
          const futureTime = new Date(now.getTime() + 5 * 60 * 1000);
          commuteData = await routesAPI.calculateAllCommuteTimesWithDepartureTime(
            originAddress, 
            destinationAddress, 
            futureTime,
            trafficModel
          );
        } else {
          commuteData = await routesAPI.calculateAllCommuteTimesWithDepartureTime(
            originAddress, 
            destinationAddress, 
            departureDateTime,
            trafficModel
          );
        }
      } else {
        commuteData = await routesAPI.calculateAllCommuteTimes(originAddress, destinationAddress, undefined, trafficModel);
      }

      // Extract and format the data
      const carRoute = commuteData.car.routes[0];
      const transitRoute = commuteData.transit.routes[0];

      if (carRoute && transitRoute) {
        const carLeg = carRoute.legs[0];
        const transitLeg = transitRoute.legs[0];

        const formattedCommuteData = {
          car: {
            time: routesAPI.formatDuration(carLeg.duration),
            distance: routesAPI.formatDistance(carLeg.distanceMeters),
            insights: departureDate 
              ? `${getTrafficLevel(carLeg.duration, carLeg.distanceMeters)} expected for ${formatDepartureDateTime()}`
              : `${getTrafficLevel(carLeg.duration, carLeg.distanceMeters)} currently`
          },
          transit: {
            time: routesAPI.formatDuration(transitLeg.duration),
            insights: departureDate 
              ? `Transit prediction for ${formatDepartureDateTime()}, check for service updates`
              : 'Real-time transit data, check for service updates'
          }
        };

        // Cache the results
        setCommuteCache(prev => ({
          ...prev,
          [cacheKey]: {
            ...formattedCommuteData,
            timestamp: Date.now()
          }
        }));

        // Save to localStorage for persistence across sessions
        const savedCache = JSON.parse(localStorage.getItem('commuteCache') || '{}');
        savedCache[cacheKey] = {
          ...formattedCommuteData,
          timestamp: Date.now()
        };
        localStorage.setItem('commuteCache', JSON.stringify(savedCache));

        setCommuteTimes({
          ...formattedCommuteData,
          loading: false
        });

      } else {
        throw new Error('No routes found');
      }

    } catch (error) {
      console.error('Error calculating commute times:', error);
      
      // Check if it's an API key error
      if (error instanceof Error && error.message.includes('API key')) {
        setCommuteTimes(prev => ({
          ...prev,
          loading: false,
          error: 'Commute analysis requires Google Routes API key. Please check your configuration.'
        }));
      } else {
        setCommuteTimes(prev => ({
          ...prev,
          loading: false,
          error: 'Unable to calculate commute times. Please check your location and try again.'
        }));
      }
    }
  }, [userLocation, selectedJob, commuteCache, departureDate, departureTime, trafficModel]);

  // Main effect to trigger commute calculations.
  useEffect(() => {
    calculateCommuteTimes();
  }, [calculateCommuteTimes]);


  // Effect to automatically update time if selected date is today but time is in the past
  useEffect(() => {
    if (departureDate && departureDate.toDateString() === new Date().toDateString()) {
      const now = new Date();
      const [hours, minutes] = departureTime.split(':').map(Number);
      const selectedTime = new Date(departureDate);
      selectedTime.setHours(hours, minutes, 0, 0);
      
      if (selectedTime <= now) {
        // Set time to current time + 5 minutes
        const futureTime = new Date(now.getTime() + 5 * 60 * 1000);
        const futureHours = futureTime.getHours().toString().padStart(2, '0');
        const futureMinutes = futureTime.getMinutes().toString().padStart(2, '0');
        setDepartureTime(`${futureHours}:${futureMinutes}`);
      }
    }
  }, [departureDate, departureTime]);

  const handleApply = async (jobId: number) => {
    if (!currentUser?.user_id) {
      // Redirect to login if not authenticated
      navigate('/login');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          jobpost_id: jobId
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Add to applied jobs set
        setAppliedJobs(prev => new Set([...prev, jobId]));
      } else {
        setError('Failed to apply for job');
      }
    } catch (err) {
      setError('Error applying for job');
      console.error('Error applying for job:', err);
    }
  };

  const handleContact = async (posterId: number) => {
    if (!currentUser?.user_id) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/chat/check-or-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          target_user_id: posterId
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Cache the job post information for the chat interface
        const jobPostInfo = {
          jobpost_id: selectedJob.jobpost_id,
          title: selectedJob.title,
          location: selectedJob.location,
          company_location: selectedJob.location, // For compatibility with chat interface
          date: selectedJob.date,
          description: selectedJob.description,
          qualifications: selectedJob.qualifications,
          salary: selectedJob.salary,
          pictures_url: selectedJob.pictures_url,
          first_name: selectedJob.first_name,
          last_name: selectedJob.last_name,
          profile_picture_url: selectedJob.profile_picture_url,
          user_id: selectedJob.user_id
        };
        localStorage.setItem('selectedChatJobPost', JSON.stringify(jobPostInfo));
        
        // Cache the selected job post for when returning to jobs page
        localStorage.setItem('selectedJobPostId', selectedJob.jobpost_id.toString());
        
        // Navigate to chat page
        localStorage.setItem('selectedChatUserId', posterId.toString());
        navigate('/chat');
      } else {
        setError('Failed to create chat');
      }
    } catch (err) {
      setError('Error creating chat');
      console.error('Error creating chat:', err);
    }
  };

  const isJobApplied = (jobId: number) => {
    return appliedJobs.has(jobId);
  };

  // Helper function to check if current commute data is from cache
  const isCommuteDataFromCache = () => {
    if (!userLocation || !selectedJob) return false;
    const originAddress = userLocation.address || `${userLocation.latitude},${userLocation.longitude}`;
    const destinationAddress = selectedJob.location;
    const departureKey = departureDate ? formatDepartureDateTime() : 'default';
    const cacheKey = `${originAddress}|${destinationAddress}|${departureKey}|${trafficModel}`;
    return commuteCache[cacheKey] !== undefined;
  };

  // Filter job posts based on search term
  const filteredJobPosts = jobPosts.filter(job =>
    // Exclude jobs created by the current user
    job.user_id !== currentUser?.user_id &&
    // Include search term filtering
    (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
     job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (job.name && job.name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMilliseconds = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  // Handle sort button clicks
  const handleSortClick = (sortType: 'date') => {
    if (sortType === 'date') {
      setSortDate(sortDate === 'asc' ? 'desc' : 'asc');
    }
  };

  // Helper function to clear commute cache
  const clearCommuteCache = () => {
    setCommuteCache({});
    localStorage.removeItem('commuteCache');
  };

  // Add this function to handle Enter key press:
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSync();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job posts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">JB</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">JobBoard</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={() => setShowPostJob(!showPostJob)} className="bg-blue-600 hover:bg-blue-700">
              {showPostJob ? 'Back to Jobs' : 'Post a Job'}
            </Button>
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-1 p-2 h-auto">
                      <span className="text-sm text-gray-700">
                        Welcome, {currentUser.first_name}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate('/chat')} className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>My Messages</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/my-jobs')} className="flex items-center space-x-2">
                      <Briefcase className="w-4 h-4" />
                      <span>My Posted Jobs</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  <LogOut className="w-4 h-4 mr-1" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button onClick={() => navigate('/login')} variant="outline">
                Login/Signup
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 h-[calc(100vh-120px)]">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
          {/* Left Side - Job Preview or Job Listings */}
          <div className="lg:col-span-2 space-y-4 h-full">
            {showPostJob ? (
              /* Job Preview */
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Job Preview</h2>
                      <p className="text-sm text-gray-600">This is how your job posting will appear</p>
                    </div>
                    <Button 
                      onClick={handleSync}
                      disabled={!jobDescription.trim() || isLoading}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      {isLoading ? 'Syncing...' : 'Sync'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showPreview && (jobDescription || companyName || jobTitle) ? (
                    <div className="space-y-6">
                      {/* Job Header */}
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h1 className="text-2xl font-bold text-gray-900 mb-2">{jobTitle || "New Job Posting"}</h1>
                              <p className="text-lg text-blue-600 mb-2">{companyName || "Your Company"}</p>
                              <div className="flex items-center text-gray-600 mb-1">
                                <MapPin className="w-4 h-4 mr-2" />
                                <span className="underline underline-offset-2 mr-2">{location || "Location"}</span>
                                <span>- Just&nbsp;Posted</span>
                              </div>
                              <div className="flex items-center text-lg font-semibold text-green-700">
                                <DollarSign className="w-5 h-5 mr-1" />
                                <span>{salaryRange || "Salary TBD"}</span>
                          </div>
                            </div>
                            <div className="flex flex-col space-y-2">
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                Active
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex space-x-3">
                            <Button className="bg-blue-600 hover:bg-blue-700" disabled>
                              Apply Now
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Contact Information */}
                      <Card>
                        <CardHeader>
                          <h3 className="text-lg font-semibold flex items-center">
                            <Users className="w-5 h-5 mr-2" />
                            Who to contact
                          </h3>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative flex shrink-0 overflow-hidden rounded-full bg-blue-600 w-10 h-10">
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600">
                                  <span className="text-white font-semibold text-sm">
                                    {currentUser?.first_name?.charAt(0) || 'U'}{currentUser?.last_name?.charAt(0) || 'S'}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {currentUser?.first_name || 'Your'} {currentUser?.last_name || 'Name'}
                                </p>
                                <p className="text-sm text-gray-600">Job Poster</p>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled
                            >
                              Contact
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* About the Job */}
                      <Card>
                        <CardHeader>
                          <h3 className="text-lg font-semibold">About the job</h3>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                            <p className="text-gray-700 leading-relaxed">{extractedDescription || jobDescription}</p>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">Qualifications</h4>
                            <ul className="space-y-2">
                              {extractedQualifications ? (
                                extractedQualifications.split(',').map((qual, index) => (
                                  <li key={index} className="flex items-start">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                                    <span className="text-gray-700">{qual.trim()}</span>
                                  </li>
                                ))
                              ) : (
                                <li className="flex items-start">
                                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                                  <span className="text-gray-700">To be determined</span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Work Schedule */}
                      {workSchedule && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold flex items-center">
                              <Clock className="w-5 h-5 mr-2" />
                              Work Schedule
                            </h3>
                          </CardHeader>
                          <CardContent>
                            <p className="text-gray-700">{workSchedule}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* Contact Information */}
                        {contactInfo && (
                        <Card>
                          <CardHeader>
                            <h3 className="text-lg font-semibold">Contact Information</h3>
                          </CardHeader>
                          <CardContent>
                            <p className="text-gray-700">{contactInfo}</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Type your job description and press Enter to see the preview</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Original Job Listings */
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Welcome to JobBoard!
                    </h2>
                    <Badge variant="secondary" className="whitespace-nowrap">{filteredJobPosts.length} results</Badge>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge 
                      variant="outline"
                      className="cursor-pointer flex items-center space-x-1"
                      onClick={() => handleSortClick('date')}
                    >
                      <span className="mr-2">Date posted</span>
                      {sortDate === 'asc' ? '↑' : '↓'}
                    </Badge>
                  </div>
                </div>

                {/* Job Listings - Only this section scrolls */}
                <div className="space-y-3 overflow-y-auto h-[calc(100vh-280px)]">
                  {filteredJobPosts.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-gray-500">No job posts found. Try adjusting your search terms.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredJobPosts.map((job) => (
                      <div key={job.jobpost_id} className="w-[95%] mx-auto">
                        <Card 
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedJob?.jobpost_id === job.jobpost_id 
                              ? 'ring-2 ring-blue-500 shadow-lg border-blue-500 bg-blue-50' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedJob(job)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-1">{job.title}</h3>
                                {job.name && (
                                  <p className="text-sm text-blue-600 mb-1">{job.name}</p>
                                )}
                                <div className="flex items-start justify-start text-sm text-gray-600 mb-1">
                                  <MapPin className="w-3 h-3 mr-1 mt-0.5" />
                                  <span>{job.location}</span>
                                </div>
                                <div className="flex items-start text-sm text-green-700 font-medium">
                                  <DollarSign className="w-3 h-3 mr-1 mt-0.5" />
                                  <span>{job.salary}</span>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                Posted {formatDate(job.date)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Side - Post Job Form or Job Details */}
          <div className="lg:col-span-3 h-full overflow-y-auto">
            {showPostJob ? (
              /* Post Job Form */
              <Card className="h-full">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Post a New Job</h2>
                  <p className="text-sm text-gray-600">Describe your job opening and IBM Granite 3.3 will help you create a professional listing</p>
                </CardHeader>
                <CardContent className="space-y-6 overflow-y-auto h-[calc(100vh-200px)] pr-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Description <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      placeholder="Example: a waiter that works night shift from Monday - Wednesday, 5pm - 10pm, at Thien Huong sandwiches San jose, CA salary: 16.5$"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="h-32 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Describe the role, schedule, requirements, and any other important details. Press Enter or use the Sync button to auto-fill the fields below using IBM Granite 3.3 AI.
                    </p>
                  </div>

                  {/* Only show these fields after sync has been performed */}
                  {(companyName || jobTitle || location || salaryRange || workSchedule || extractedDescription || extractedQualifications) && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Company Name <span className="text-red-500">*</span>
                          </label>
                          <Input 
                            placeholder="Your Company" 
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className={!companyName && jobDescription ? 'border-orange-300 focus:border-orange-500' : ''}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Job Title <span className="text-red-500">*</span>
                          </label>
                          <Input 
                            placeholder="e.g. Waiter/Waitress" 
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            className={!jobTitle && jobDescription ? 'border-orange-300 focus:border-orange-500' : ''}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Location
                          </label>
                          <Input 
                            placeholder="City, State" 
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Salary Range
                          </label>
                          <Input 
                            placeholder="e.g. $16/hour + tips" 
                            value={salaryRange}
                            onChange={(e) => setSalaryRange(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Work Schedule
                          </label>
                          <Input 
                            placeholder="e.g. Monday-Wednesday 5pm-10pm" 
                            value={workSchedule}
                            onChange={(e) => setWorkSchedule(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Professional Description
                        </label>
                        <Textarea
                          placeholder="AI will generate a professional job description..."
                          value={extractedDescription}
                          onChange={(e) => setExtractedDescription(e.target.value)}
                          className="h-24 resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Professional job description generated by AI. You can edit this to match your needs.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Qualifications
                        </label>
                        <Textarea
                          placeholder="AI will extract required qualifications..."
                          value={extractedQualifications}
                          onChange={(e) => setExtractedQualifications(e.target.value)}
                          className="h-20 resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Required qualifications and skills. You can edit this list.
                        </p>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-end space-x-3 pt-4 pb-4">
                    <Button variant="outline" onClick={() => setShowPostJob(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handlePostJob} 
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={!jobDescription.trim() || !jobTitle.trim() || !companyName.trim()}
                    >
                      Post Job
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Original Job Details */
              <>
                {selectedJob ? (
                  <>
                    {/* Job Header */}
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h1>
                            <p className="text-lg text-blue-600 mb-2">{selectedJob.name}</p>
                            <div className="flex items-center text-gray-600 mb-1">
                              <MapPin className="w-4 h-4 mr-2" />
                              <span className="underline underline-offset-2 mr-2">{selectedJob.location}</span>
                              <span>- {formatDate(selectedJob.date)}</span>
                            </div>
                            <div className="flex items-center text-lg font-semibold text-green-700">
                              <DollarSign className="w-5 h-5 mr-1" />
                              <span>{selectedJob.salary}</span>
                            </div>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              Active
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex space-x-3">
                          {isJobApplied(selectedJob.jobpost_id) ? (
                            <Button className="bg-green-600 hover:bg-green-700" disabled>
                              Applied
                            </Button>
                          ) : (
                            <Button 
                              className="bg-blue-600 hover:bg-blue-700" 
                              onClick={() => handleApply(selectedJob.jobpost_id)}
                            >
                              Apply Now
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-semibold flex items-center">
                          <Users className="w-5 h-5 mr-2" />
                          Who to contact
                        </h3>
                      </CardHeader>
                      <CardContent>
                        {selectedJob.first_name && selectedJob.last_name ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <UserAvatar
                                firstName={selectedJob.first_name}
                                lastName={selectedJob.last_name}
                                profilePictureUrl={selectedJob.profile_picture_url}
                                size={40}
                              />
                              <div>
                                <p className="font-medium text-gray-900">
                                  {selectedJob.first_name} {selectedJob.last_name}
                                </p>
                                <p className="text-sm text-gray-600">Job Poster</p>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleContact(selectedJob.user_id)}
                            >
                              Contact
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-gray-500">Contact information not available</p>
                            <Button variant="outline" size="sm" disabled>
                              Contact
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* About the Job */}
                    <Card>
                      <CardHeader>
                        <h3 className="text-lg font-semibold">About the job</h3>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                            <p className="text-gray-700 leading-relaxed">{selectedJob.description}</p>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">Qualifications</h4>
                            <ul className="space-y-2">
                              {selectedJob.qualifications.split(',').map((qual, index) => (
                                <li key={index} className="flex items-start">
                                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                                  <span className="text-gray-700">{qual.trim()}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Commute Analysis */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Commute Analysis</h3>
                            {locationLoading && (
                              <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span>Detecting location...</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">Transportation options to {selectedJob.location}</p>
                          {userLocation && (
                            <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-md">
                              <MapPin className="w-4 h-4" />
                              <span>From: {userLocation.address}</span>
                            </div>
                          )}
                          {locationError && (
                            <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md">
                              {locationError}
                            </div>
                          )}
                        </CardHeader>
                          <CardContent className="space-y-4">
                            {locationLoading || commuteTimes.loading ? (
                              <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                  {locationLoading ? 'Detecting Your Location' : 'Calculating Commute Times'}
                                </h4>
                                <p className="text-gray-600">
                                  {locationLoading 
                                    ? 'Getting your location to provide personalized commute analysis...'
                                    : 'Getting real-time commute data from your location...'
                                  }
                                </p>
                              </div>
                            ) : userLocation && commuteTimes.car.time ? (
                              <div>
                                {/* Traffic Model Indicator */}
                                <div className="flex items-center justify-end mb-4">
                                  <div className="flex items-center space-x-2 relative">
                                    <Button variant="outline" size="sm" onClick={() => setShowDeparturePicker((v) => !v)}>
                                      <Calendar className="w-4 h-4 mr-2" />
                                      {formatDepartureDateTime()}
                                    </Button>
                                    {showDeparturePicker && (
                                      <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10 min-w-[300px]">
                                        <div className="space-y-4">
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                              Date
                                            </label>
                                            <CalendarComponent
                                              mode="single"
                                              selected={departureDate}
                                              onSelect={setDepartureDate}
                                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                              className="rounded-md border"
                                              fromDate={new Date()}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                              Time
                                            </label>
                                            <Input
                                              type="time"
                                              value={departureTime}
                                              onChange={(e) => setDepartureTime(e.target.value)}
                                              min={departureDate && departureDate.toDateString() === new Date().toDateString() 
                                                ? new Date().toTimeString().slice(0, 5) 
                                                : undefined}
                                              className="w-full"
                                            />
                                          </div>
                                          <div className="flex justify-end space-x-2 pt-4">
                                            <Button
                                              variant="outline"
                                              onClick={() => setShowDeparturePicker(false)}
                                            >
                                              Cancel
                                            </Button>
                                            <Button 
                                              className="bg-blue-600 hover:bg-blue-700"
                                              onClick={() => {
                                                setShowDeparturePicker(false);
                                                calculateCommuteTimes();
                                              }}
                                            >
                                              Set Time & Recalculate
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* By Car */}
                                  <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center mb-3">
                                      <Car className="w-5 h-5 mr-2 text-blue-600" />
                                      <h4 className="font-medium">By Car</h4>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                        <span><strong>Estimated Time:</strong> {commuteTimes.car.time}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                                        <span><strong>Distance:</strong> {commuteTimes.car.distance}</span>
                                      </div>
                                      <p className="text-gray-600 mt-2">
                                        <strong>Insights:</strong> {commuteTimes.car.insights}
                                      </p>
                                    </div>
                                  </div>

                                  {/* By Transit */}
                                  <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center mb-3">
                                      <Bus className="w-5 h-5 mr-2 text-green-600" />
                                      <h4 className="font-medium">By Public Transit</h4>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                        <span><strong>Estimated Time:</strong> {commuteTimes.transit.time}</span>
                                      </div>
                                      <p className="text-gray-600 mt-2">
                                        <strong>Insights:</strong> {commuteTimes.transit.insights}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h4 className="text-lg font-medium text-gray-900 mb-2">
                                  {commuteTimes.error ? 'Commute Calculation Failed' : 'Location Detection Failed'}
                                </h4>
                                <p className="text-gray-600 mb-4">
                                  {commuteTimes.error || 'We couldn\'t automatically detect your location. Commute analysis will show general estimates.'}
                                </p>
                                <Button
                                  onClick={getUserLocationFromIP}
                                  disabled={locationLoading}
                                  variant="outline"
                                >
                                  Try Again
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Company Images */}
                        {selectedJob.pictures_url && (
                          <Card>
                            <CardHeader>
                              <h3 className="text-lg font-semibold">Job Images</h3>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedJob.pictures_url.split(',').map((image, index) => (
                                  <div key={index} className="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                      <Building2 className="w-12 h-12" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-sm text-gray-600 mt-3">
                                Workplace photos showing team environment and daily operations
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-gray-500">Select a job to view details</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;