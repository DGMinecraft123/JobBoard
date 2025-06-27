import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, DollarSign, Clock, Car, Bus, Building2, Users, Star, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

const Index = () => {
  const [jobPosts, setJobPosts] = useState<JobPost[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPostJob, setShowPostJob] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const navigate = useNavigate();

  // Fetch job posts from database
  useEffect(() => {
    const fetchJobPosts = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3001/api/jobposts');
        const result = await response.json();
        
        if (result.success) {
          setJobPosts(result.data);
          if (result.data.length > 0) {
            setSelectedJob(result.data[0]);
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
  }, []);

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
            setJobPosts(refreshResult.data);
            setSelectedJob(refreshResult.data[0]);
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

  // Filter job posts based on search term
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
                <div className="text-sm text-gray-700">
                  Welcome, {currentUser.first_name}!
                </div>
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

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Side - Changes based on showPostJob */}
          <div className="lg:col-span-2 space-y-4">
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
                      Jobs in {jobPosts.length > 0 ? jobPosts[0].location : 'All Locations'}
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
                        <p className="text-gray-500">No job posts found. Try adjusting your search terms.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredJobPosts.map((job) => (
                      <Card 
                        key={job.jobpost_id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${selectedJob?.jobpost_id === job.jobpost_id ? 'ring-2 ring-blue-500 shadow-md' : ''}`}
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
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Side - Changes based on showPostJob */}
          <div className="lg:col-span-3">
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
                          <Button className="bg-blue-600 hover:bg-blue-700">
                            Apply Now
                          </Button>
                          <Button variant="outline">
                            Save Job
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
                              {selectedJob.profile_picture_url ? (
                                <img 
                                  src={selectedJob.profile_picture_url} 
                                  alt={`${selectedJob.first_name} ${selectedJob.last_name}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                  <span className="text-white font-semibold text-sm">
                                    {selectedJob.first_name[0]}{selectedJob.last_name[0]}
                                  </span>
                                </div>
                              )}
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
                              onClick={() => navigate('/chat')}
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
    </div>
  );
};

export default Index;
