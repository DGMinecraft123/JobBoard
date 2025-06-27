import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/lib/auth';
import socketService from '@/lib/socket';

// Interfaces for database objects
interface JobPoster {
  user_id: number;
  first_name: string;
  last_name: string;
  profile_picture_url: string;
  jobpost_id: number;
  job_title: string;
  company_location: string;
  job_posted_date: string;
}

interface Message {
  message_id: number;
  message_content: string;
  message_time: string;
  user_id: number;
  first_name: string;
  last_name: string;
  profile_picture_url: string;
}

const Chat = () => {
  const [jobPosters, setJobPosters] = useState<JobPoster[]>([]);
  const [selectedPoster, setSelectedPoster] = useState<JobPoster | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser] = useState(getCurrentUser());
  const [isConnected, setIsConnected] = useState(false);
  const [currentGroupChatId, setCurrentGroupChatId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [sendingMessage, setSendingMessage] = useState(false);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const socket = socketService.connect();
    
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    // Listen for new messages
    socketService.onNewMessage((message: Message) => {
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const messageExists = prev.some(m => m.message_id === message.message_id);
        if (messageExists) {
          return prev;
        }
        return [...prev, message];
      });
    });

    // Listen for typing indicators
    socketService.onTyping((data: { userId: number, isTyping: boolean }) => {
      if (data.userId !== currentUser?.user_id) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.userId);
          } else {
            newSet.delete(data.userId);
          }
          return newSet;
        });
      }
    });

    // Listen for socket errors
    socketService.onError((error) => {
      console.error('Socket error:', error);
      setError(error.message || 'Socket connection error');
    });

    return () => {
      socketService.offNewMessage();
      socketService.offTyping();
      socketService.offError();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    };

    // Use a small delay to ensure the DOM has updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Fetch job posters from database
  useEffect(() => {
    const fetchJobPosters = async () => {
      try {
        setLoading(true);
        if (!currentUser) {
          setError('User not logged in');
          return;
        }
        
        const response = await fetch(`http://localhost:3001/api/job-posters?user_id=${currentUser.user_id}`);
        const result = await response.json();
        
        if (result.success) {
          setJobPosters(result.data);
          if (result.data.length > 0) {
            setSelectedPoster(result.data[0]);
          }
        } else {
          setError('Failed to fetch job posters');
        }
      } catch (err) {
        setError('Error connecting to server');
        console.error('Error fetching job posters:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobPosters();
  }, [currentUser]);

  // Fetch messages and join group chat when selected poster changes
  useEffect(() => {
    if (selectedPoster && currentUser) {
      // Clear typing indicators when switching users
      setTypingUsers(new Set());
      fetchMessages(selectedPoster.user_id);
    }
  }, [selectedPoster, currentUser]);

  const fetchMessages = async (posterId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/job-posters/${posterId}/messages?user_id=${currentUser.user_id}`);
      const result = await response.json();
      
      if (result.success) {
        setMessages(result.data);
        
        // Find the group chat ID for socket operations
        const groupChatResponse = await fetch(`http://localhost:3001/api/job-posters/${posterId}/group-chat?user_id=${currentUser.user_id}`);
        const groupChatResult = await groupChatResponse.json();
        
        if (groupChatResult.success) {
          setCurrentGroupChatId(groupChatResult.data.groupchat_id);
          // Join the group chat room via socket
          socketService.joinGroupChat(currentUser.user_id, posterId);
        }
      } else {
        if (response.status === 404) {
          // No group chat exists between these users
          setMessages([]);
          setCurrentGroupChatId(null);
          setError(null); // Clear any previous errors
        } else {
          setError('Failed to fetch messages');
        }
      }
    } catch (err) {
      setError('Error fetching messages');
      console.error('Error fetching messages:', err);
    }
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() && selectedPoster && currentUser && isConnected && !sendingMessage) {
      try {
        setSendingMessage(true);
        
        // Clear typing indicator
        if (isTyping) {
          setIsTyping(false);
          socketService.sendTyping(currentUser.user_id, selectedPoster.user_id, false, currentGroupChatId || undefined);
        }
        
        // Clear typing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Store the message content before clearing
        const messageContent = newMessage.trim();
        
        // Clear the input immediately for better UX
        setNewMessage("");

        // Send message via Socket.IO
        socketService.sendMessage(
          messageContent,
          currentUser.user_id,
          selectedPoster.user_id,
          currentGroupChatId || undefined
        );
        
      } catch (err) {
        setError('Error sending message');
        console.error('Error sending message:', err);
      } finally {
        setSendingMessage(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    if (!isTyping && selectedPoster && currentUser && isConnected) {
      setIsTyping(true);
      socketService.sendTyping(currentUser.user_id, selectedPoster.user_id, true, currentGroupChatId || undefined);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && selectedPoster && currentUser && isConnected) {
        setIsTyping(false);
        socketService.sendTyping(currentUser.user_id, selectedPoster.user_id, false, currentGroupChatId || undefined);
      }
    }, 1000);
  };

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
          <p className="text-gray-600">Loading chats...</p>
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Jobs</span>
          </Button>
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">JB</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex justify-center">
        <div className="max-w-7xl w-full flex-1 min-h-0 flex px-6 py-6">
          {/* Contacts List */}
          <div className="w-full lg:w-1/3 max-w-md flex flex-col h-full min-h-0 pr-6">
            <Card className="h-full flex flex-col">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="p-4 border-b flex-shrink-0">
                  <h2 className="text-lg font-semibold">Contacts</h2>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                  {jobPosters.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <p className="text-sm">No job posters available</p>
                      <p className="text-xs mt-1">Job posters will appear here when they join group chats</p>
                    </div>
                  ) : (
                    jobPosters.map((poster) => (
                      <div key={poster.user_id}>
                        <div 
                          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedPoster?.user_id === poster.user_id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                          }`}
                          onClick={() => setSelectedPoster(poster)}
                        >
                          <div className="flex items-start space-x-3">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={poster.profile_picture_url} alt={poster.job_title} />
                              <AvatarFallback>
                                {poster.job_title.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium text-gray-900 truncate">
                                  {poster.first_name} {poster.last_name}
                                </h3>
                                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                  {formatDate(poster.job_posted_date)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate mb-1">
                                Job Poster - {poster.company_location}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {poster.job_title}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Separator />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Module */}
          <div className="flex-1 min-w-0 flex flex-col h-full">
            {selectedPoster ? (
              <Card className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={selectedPoster?.profile_picture_url} alt={`${selectedPoster?.first_name} ${selectedPoster?.last_name}`} />
                        <AvatarFallback>
                          {selectedPoster?.first_name[0]}{selectedPoster?.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{selectedPoster?.first_name} {selectedPoster?.last_name}</h3>
                        <p className="text-sm text-gray-600 truncate">Job Poster - {selectedPoster?.company_location}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-xs text-gray-500">
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        <p className="text-lg font-medium mb-2">No messages yet</p>
                        <p className="text-sm">Start a conversation by sending a message!</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => (
                        <div key={message.message_id} className={`flex ${message.user_id === currentUser.user_id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.user_id === currentUser.user_id 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-900'
                          }`}>
                            <p className="text-sm break-words">{message.message_content}</p>
                            <p className={`text-xs mt-1 ${
                              message.user_id === currentUser.user_id ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatDate(message.message_time)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {typingUsers.size > 0 && (
                        <div className="flex justify-start">
                          <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                            <div className="flex items-center space-x-1">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                              <span className="text-xs text-gray-600 ml-2">Typing...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t flex-shrink-0">
                  <div className="flex space-x-2">
                    <Input
                      placeholder={isConnected ? "Type a message..." : "Connecting..."}
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                      disabled={!selectedPoster || !isConnected}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={!selectedPoster || !newMessage.trim() || !isConnected || sendingMessage}
                    >
                      {sendingMessage ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {!isConnected && (
                    <p className="text-xs text-red-500 mt-2">Disconnected from server. Trying to reconnect...</p>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="text-lg font-medium mb-2">Select a contact</p>
                  <p className="text-sm">Choose a job poster from the list to start chatting</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
