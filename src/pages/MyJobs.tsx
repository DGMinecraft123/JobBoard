import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, DollarSign, Clock, Car, Bus, Building2, Users, Star, LogOut, ChevronDown, MessageSquare, Briefcase, X, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getCurrentUser, logoutUser } from '@/lib/auth';

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
}

// Applicant interface
interface Applicant {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  applied_date: string;
  profile_picture_url?: string;
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

const MyJobs = () => {
  const [jobPosts, setJobPosts] = useState<JobPost[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPostJob, setShowPostJob] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const navigate = useNavigate();

  // Fetch applicants for a specific job
  const fetchApplicants = async (jobId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/applications/job/${jobId}`);
      const result = await response.json();
      
      if (result.success) {
        // Transform the API response to match our Applicant interface
        const transformedApplicants: Applicant[] = result.data.map((app: any) => ({
          id: app.user_id, // Using user_id as id since we don't have application_id
          first_name: app.first_name,
          last_name: app.last_name,
          email: app.email,
          applied_date: app.applied_date,
          profile_picture_url: app.profile_picture_url // Let UserAvatar handle validation
        }));
        setApplicants(transformedApplicants);
      } else {
        console.error('Failed to fetch applicants:', result.message);
        setApplicants([]);
      }
    } catch (err) {
      console.error('Error fetching applicants:', err);
      setApplicants([]);
    }
  };

  const handleViewApplicants = async () => {
    if (selectedJob) {
      await fetchApplicants(selectedJob.jobpost_id);
      setShowApplicants(true);
    }
  };

  // Fetch job posts from database
  useEffect(() => {
    const fetchJobPosts = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3001/api/jobposts');
        const result = await response.json();
        
        if (result.success) {
          // Filter to only show current user's jobs
          const userJobs = result.data.filter((job: JobPost) => job.user_id === currentUser?.user_id);
          setJobPosts(userJobs);
          if (userJobs.length > 0) {
            setSelectedJob(userJobs[0]);
          }
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
  }, [currentUser?.user_id]);

  const handlePostJob = async () => {
    if (jobDescription.trim()) {
      try {
        // Use current user's ID if authenticated, otherwise use default
        const userId = currentUser?.user_id || 1;
        
        const response = await fetch('http://localhost:3001/api/jobposts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'New Job Posting',
            location: 'Location TBD',
            description: jobDescription,
            pictures_url: '',
            qualifications: 'To be determined',
            salary: 'Salary TBD',
            user_id: userId
          }),
        });

        const result = await response.json();
        if (result.success) {
          // Refresh job posts
          const refreshResponse = await fetch('http://localhost:3001/api/jobposts');
          const refreshResult = await refreshResponse.json();
          if (refreshResult.success) {
            const userJobs = refreshResult.data.filter((job: JobPost) => job.user_id === currentUser?.user_id);
            setJobPosts(userJobs);
            setSelectedJob(userJobs[0]);
          }
          setJobDescription("");
          setShowPostJob(false);
        } else {
          setError('Failed to post job');
        }
      } catch (err) {
        setError('Error posting job');
        console.error('Error posting job:', err);
      }
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    navigate('/');
  };

  // Filter job posts based on search term (only user's own jobs)
  const filteredJobPosts = jobPosts.filter(job =>
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your job posts...</p>
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
            <h1 
              className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => navigate('/')}
            >
              JobBoard
            </h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search your jobs..."
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
                    <DropdownMenuItem onClick={() => {
                      localStorage.removeItem('selectedChatUserId');
                      navigate('/chat');
                    }} className="flex items-center space-x-2">
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
          {/* Left Side - Changes based on showPostJob */}
          <div className="lg:col-span-2 space-y-4 overflow-y-auto h-full">
            {showPostJob ? (
              /* Job Preview when posting */
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Job Preview</h2>
                  <p className="text-sm text-gray-600">This is how your job will appear to candidates</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobDescription ? (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h3 className="font-semibold text-gray-900 mb-2">Job Description</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">{jobDescription}</p>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <p className="text-gray-500">Start typing your job description to see a preview</p>
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
                      My Posted Jobs
                    </h2>
                    <Badge variant="secondary">{filteredJobPosts.length} results</Badge>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">Date posted</Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">Experience level</Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">Salary</Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">Remote</Badge>
                  </div>
                </div>

                {/* Job Listings */}
                <div className="space-y-3">
                  {filteredJobPosts.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-gray-500">No job posts found. Try posting a new job or adjusting your search terms.</p>
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
                                <p className="text-sm text-blue-600 mb-1">{job.location}</p>
                                <div className="flex items-center text-sm text-gray-600 mb-2">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  <span>{job.location} - {formatDate(job.date)}</span>
                                </div>
                                <div className="flex items-center text-sm text-green-700 font-medium">
                                  <DollarSign className="w-3 h-3 mr-1" />
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

          {/* Right Side - Changes based on showPostJob */}
          <div className="lg:col-span-3 overflow-y-auto h-full">
            {showPostJob ? (
              /* Job Posting Form */
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Post a New Job</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Description
                    </label>
                    <textarea
                      placeholder="Example: a waiter that works night shift from Monday - Wednesday, 5pm - 10pm"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <Button variant="outline" onClick={() => setShowPostJob(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handlePostJob} className="bg-blue-600 hover:bg-blue-700">
                      Post Job
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Original Job Details */
              <div className="space-y-6">
                {selectedJob ? (
                  <>
                    {/* Job Header */}
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h1>
                            <p className="text-lg text-blue-600 mb-2">{selectedJob.location}</p>
                            <div className="flex items-center text-gray-600 mb-2">
                              <MapPin className="w-4 h-4 mr-2" />
                              <span>{selectedJob.location} - {formatDate(selectedJob.date)}</span>
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
                          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleViewApplicants}>
                            View Applicants
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
                        {selectedJob.first_name && selectedJob.last_name ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <UserAvatar firstName={selectedJob.first_name} lastName={selectedJob.last_name} profilePictureUrl={selectedJob.profile_picture_url} />
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
                              disabled
                            >
                              Contact
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-gray-500">Contact information not available</p>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled
                            >
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Applicants Modal */}
      {showApplicants && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Applicants for {selectedJob?.title}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApplicants(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {applicants.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No applicants yet for this position.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {applicants.map((applicant) => (
                    <Card key={applicant.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <UserAvatar firstName={applicant.first_name} lastName={applicant.last_name} profilePictureUrl={applicant.profile_picture_url} />
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {applicant.first_name} {applicant.last_name}
                              </h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                <div className="flex items-center">
                                  <Mail className="w-3 h-3 mr-1" />
                                  <span>{applicant.email}</span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Applied {formatDate(applicant.applied_date)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled
                            >
                              Contact
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyJobs; 