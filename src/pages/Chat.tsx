import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Search, LogOut, ChevronDown, MessageSquare, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '@/lib/auth';
import socketService from '@/lib/socket';

// List of supported languages
const SUPPORTED_LANGUAGES = [
  { code: 'english', name: 'English', countryCode: 'US' },
  { code: 'spanish', name: 'Spanish', countryCode: 'ES' },
  { code: 'french', name: 'French', countryCode: 'FR' },
  { code: 'german', name: 'German', countryCode: 'DE' },
  { code: 'italian', name: 'Italian', countryCode: 'IT' },
  { code: 'portuguese', name: 'Portuguese', countryCode: 'PT' },
  { code: 'russian', name: 'Russian', countryCode: 'RU' },
  { code: 'chinese', name: 'Chinese', countryCode: 'CN' },
  { code: 'japanese', name: 'Japanese', countryCode: 'JP' },
  { code: 'korean', name: 'Korean', countryCode: 'KR' },
  { code: 'arabic', name: 'Arabic', countryCode: 'SA' },
  { code: 'hindi', name: 'Hindi', countryCode: 'IN' },
  { code: 'bengali', name: 'Bengali', countryCode: 'BD' },
  { code: 'urdu', name: 'Urdu', countryCode: 'PK' },
  { code: 'turkish', name: 'Turkish', countryCode: 'TR' },
  { code: 'dutch', name: 'Dutch', countryCode: 'NL' },
  { code: 'swedish', name: 'Swedish', countryCode: 'SE' },
  { code: 'norwegian', name: 'Norwegian', countryCode: 'NO' },
  { code: 'danish', name: 'Danish', countryCode: 'DK' },
  { code: 'finnish', name: 'Finnish', countryCode: 'FI' },
  { code: 'polish', name: 'Polish', countryCode: 'PL' },
  { code: 'czech', name: 'Czech', countryCode: 'CZ' },
  { code: 'hungarian', name: 'Hungarian', countryCode: 'HU' },
  { code: 'greek', name: 'Greek', countryCode: 'GR' },
  { code: 'hebrew', name: 'Hebrew', countryCode: 'IL' },
  { code: 'thai', name: 'Thai', countryCode: 'TH' },
  { code: 'vietnamese', name: 'Vietnamese', countryCode: 'VN' }
];

// Flag Image Component
const FlagImage = ({ languageCode, size = 20 }: { languageCode: string; size?: number }) => {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  if (language) {
    const countryCode = language.countryCode.toLowerCase();
    return (
      <img 
        src={`https://flagcdn.com/w${size}/${countryCode}.png`}
        alt={`${language.name} flag`}
        className="rounded-sm"
        style={{ 
          width: `${size}px`, 
          height: `${size * 0.75}px`, // Flag aspect ratio is typically 3:2
          objectFit: 'cover'
        }}
        onError={(e) => {
          // Fallback to a different flag service if the first one fails
          const target = e.target as HTMLImageElement;
          target.src = `https://flagicons.lipis.dev/flags/4x3/${countryCode}.svg`;
        }}
      />
    );
  }
  // Default globe icon if language not found
  return <span className="text-lg">🌐</span>;
};

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

// Function to get flag image for a language (for backward compatibility)
const getFlagImage = (languageCode: string, size: number = 20) => {
  return <FlagImage languageCode={languageCode} size={size} />;
};

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
  groupchat_status?: number; // 0 = pending, 1 = active
  last_message_time?: string; // Add this field for deduplication
  last_message?: string; // Add this field for message preview
  last_message_sender_id?: number; // Add this field for sender ID
  last_message_sender_first_name?: string; // Add this field for sender first name
  last_message_sender_last_name?: string; // Add this field for sender last name
}

interface CachedJobPost {
  jobpost_id: number;
  title: string;
  location: string;
  company_location: string;
  date: string;
  description: string;
  qualifications: string;
  salary: string;
  pictures_url: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string;
  user_id: number;
}

interface PendingChat {
  user_id: number;
  first_name: string;
  last_name: string;
  profile_picture_url: string;
  groupchat_id: number;
  groupchat_name: string;
  groupchat_status: number; // 0 = pending, 1 = active
  last_message: string;
  last_message_time: string;
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

// When setting job posters from API, ensure all required fields are present
export type JobPosterAPI = Omit<JobPoster, 'last_message_time' | 'groupchat_status' | 'last_message' | 'last_message_sender_id' | 'last_message_sender_first_name' | 'last_message_sender_last_name'> & {
  last_message_time?: string;
  groupchat_status?: number;
  last_message?: string;
  last_message_sender_id?: number;
  last_message_sender_first_name?: string;
  last_message_sender_last_name?: string;
};

const Chat = () => {
  const [jobPosters, setJobPosters] = useState<JobPoster[]>([]);
  const [pendingChats, setPendingChats] = useState<PendingChat[]>([]);
  const [selectedPoster, setSelectedPoster] = useState<JobPoster | null>(null);
  const [selectedPendingChat, setSelectedPendingChat] = useState<PendingChat | null>(null);
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
  const [sendingText, setSendingText] = useState("");
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active');
  const [cachedJobPost, setCachedJobPost] = useState<CachedJobPost | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [currentUserLanguage, setCurrentUserLanguage] = useState('english');
  const [translatedMessages, setTranslatedMessages] = useState<{[key: number]: string}>({});
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSelectionPerformedRef = useRef(false);

  // Load cached job post information if available
  useEffect(() => {
    const cachedJobPostStr = localStorage.getItem('selectedChatJobPost');
    if (cachedJobPostStr) {
      try {
        const jobPost: CachedJobPost = JSON.parse(cachedJobPostStr);
        setCachedJobPost(jobPost);
      } catch (error) {
        localStorage.removeItem('selectedChatJobPost');
      }
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    // Ensure we have a current user before connecting
    if (!currentUser) return;

    let connectionTimeout: NodeJS.Timeout;
    let mounted = true;
    
    const connectSocket = async () => {
      try {
        // Check if socket is already connected
        if (socketService.isSocketConnected()) {
          if (mounted) {
            setIsConnected(true);
          }
          return;
        }

        const socket = socketService.connect();
        
        // Set a connection timeout
        connectionTimeout = setTimeout(() => {
          if (mounted && !isConnected) {
            setIsConnected(true); // Force connection to proceed
            setError(null);
          }
        }, 3000); // Reduced to 3 seconds

        socket.on('connect', () => {
          if (mounted) {
            clearTimeout(connectionTimeout);
            setIsConnected(true);
            setError(null);
            
            // If we have a selected poster, join the room immediately after connection
            if (selectedPoster && currentUser) {
              socketService.joinGroupChat(currentUser.user_id, selectedPoster.user_id);
            }
          }
        });

        socket.on('disconnect', (reason: string) => {
          if (mounted) {
            setIsConnected(false);
            console.log('Socket disconnected, reason:', reason);
          }
        });

        socket.on('connect_error', (error: any) => {
          if (mounted) {
            clearTimeout(connectionTimeout);
            // Proceed without socket connection
            setIsConnected(true);
            setError(null);
          }
        });

        // Listen for new messages
        socketService.onNewMessage((message: Message) => {
          if (mounted) {
            setMessages(prev => {
              // Check if message already exists to prevent duplicates
              const messageExists = prev.some(m => m.message_id === message.message_id);
              if (messageExists) {
                return prev;
              }
              return [...prev, message];
            });
          }
        });

        // Listen for room join confirmation
        socketService.onRoomJoined((data: { roomName: string, groupChatId: number }) => {
          if (mounted) {
            console.log('✅ Successfully joined room:', data.roomName);
          }
        });

        // Listen for room join errors
        socketService.onRoomJoinError((error: { message: string }) => {
          if (mounted) {
            console.error('❌ Failed to join room:', error.message);
          }
        });

        // Listen for chat list updates
        socketService.onChatListUpdate((update: { 
          groupChatId: number, 
          lastMessage: string, 
          lastMessageTime: string, 
          senderId: number, 
          senderName: string 
        }) => {
          if (mounted) {
            // Update the job posters list with the new message
            setJobPosters(prev => prev.map(poster => {
              // Find the poster that matches this group chat
              // We need to check if this poster is in the same group chat
              // For now, we'll update based on sender ID (this is a simplified approach)
              if (poster.user_id === update.senderId) {
                return {
                  ...poster,
                  last_message: update.lastMessage,
                  last_message_time: update.lastMessageTime
                };
              }
              return poster;
            }));
          }
        });

        // Listen for typing indicators
        socketService.onTyping((data: { userId: number, isTyping: boolean }) => {
          if (mounted) {
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
          }
        });

        // Listen for socket errors
        socketService.onError((error) => {
          // Don't block the UI for socket errors
        });
      } catch (error) {
        if (mounted) {
          setIsConnected(true); // Proceed without socket
          setError(null);
        }
      }
    };

    connectSocket();

    // Cleanup function - disconnect socket when component unmounts
    return () => {
      mounted = false;
      clearTimeout(connectionTimeout);
      socketService.leaveCurrentRoom();
      socketService.offNewMessage();
      socketService.offRoomJoined();
      socketService.offRoomJoinError();
      socketService.offTyping();
      socketService.offChatListUpdate();
      socketService.offError();
      // Don't disconnect here - let the socket service manage the connection
    };
  }, [currentUser?.user_id]); // Only depend on user_id, not selectedPoster

  // Handle hot-reload scenarios
  useEffect(() => {
    // Check if this is a hot-reload scenario
    const handleBeforeUnload = () => {
      // This will be called when the page is about to reload
      console.log('🔄 Page reload detected, preparing for hot-reload');
    };

    const handleVisibilityChange = () => {
      // This will be called when the tab becomes visible again (after hot-reload)
      if (!document.hidden && currentUser && !socketService.isSocketConnected()) {
        console.log('🔄 Hot-reload detected, reconnecting socket...');
        setTimeout(() => {
          try {
            socketService.forceReconnect();
            console.log('✅ Socket reconnected after hot-reload');
            setIsConnected(true);
            
            // Re-join the current room if we have a selected poster
            if (selectedPoster && currentUser) {
              socketService.joinGroupChat(currentUser.user_id, selectedPoster.user_id);
            }
          } catch (error) {
            console.error('❌ Failed to reconnect socket after hot-reload:', error);
          }
        }, 1000); // Small delay to ensure the page is fully loaded
      }
    };

    // Listen for page visibility changes (hot-reload detection)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Check connection status periodically during development
    const connectionCheckInterval = setInterval(() => {
      if (currentUser && !socketService.isSocketConnected() && !isConnected) {
        console.log('🔄 Connection check: socket not connected, attempting reconnection...');
        try {
          socketService.forceReconnect();
          console.log('✅ Socket reconnected via periodic check');
          setIsConnected(true);
          
          if (selectedPoster && currentUser) {
            socketService.joinGroupChat(currentUser.user_id, selectedPoster.user_id);
          }
        } catch (error) {
          console.error('❌ Failed to reconnect via periodic check:', error);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(connectionCheckInterval);
    };
  }, [currentUser, selectedPoster, isConnected]);

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
    if (!currentUser) {
      console.log('No current user found, setting loading to false');
      setLoading(false);
      return;
    }
    
    console.log('Fetching job posters for user:', currentUser.user_id);
    
    const fetchJobPosters = async () => {
      try {
        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        console.log('Making API request to:', `http://localhost:3001/api/job-posters?user_id=${currentUser.user_id}`);
        
        const response = await fetch(`http://localhost:3001/api/job-posters?user_id=${currentUser.user_id}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        console.log('API response status:', response.status);
        
        const result = await response.json();
        console.log('API response data:', result);
        
        if (result.success) {
          const posters = result.data;
          setJobPosters(posters);
          
          // Auto-select first poster if no selection exists
          if (posters.length > 0 && !selectedPoster && !selectedPendingChat) {
            setSelectedPoster(posters[0]);
          }
        } else {
          setError('Failed to fetch job posters');
        }
      } catch (err) {
        console.error('Error in fetchJobPosters:', err);
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Request timed out. Please check your connection.');
        } else {
          setError('Error fetching job posters');
        }
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
      }
    };
    fetchJobPosters();
  }, [currentUser]);

  // Fetch pending chats
  useEffect(() => {
    const fetchPendingChats = async () => {
      if (!currentUser?.user_id) return;
      
      try {
        const response = await fetch(`http://localhost:3001/api/chat/pending/${currentUser.user_id}`);
        const result = await response.json();
        
        if (result.success) {
          setPendingChats(result.data);
        }
      } catch (err) {
        console.error('Error fetching pending chats:', err);
      }
    };

    fetchPendingChats();
  }, [currentUser?.user_id]);

  // Function to refresh both chat lists
  const refreshChatLists = async () => {
    if (!currentUser?.user_id) return;
    
    try {
      // Refresh job posters (active chats)
      const jobPostersResponse = await fetch(`http://localhost:3001/api/job-posters?user_id=${currentUser.user_id}`);
      const jobPostersResult = await jobPostersResponse.json();
      if (jobPostersResult.success) {
        const posters: JobPoster[] = jobPostersResult.data.map((poster: JobPosterAPI) => ({
          ...poster,
          last_message_time: poster.last_message_time || poster.job_posted_date || '',
          groupchat_status: poster.groupchat_status ?? 1,
          last_message: poster.last_message || '',
          last_message_sender_id: poster.last_message_sender_id,
          last_message_sender_first_name: poster.last_message_sender_first_name || '',
          last_message_sender_last_name: poster.last_message_sender_last_name || '',
        }));
        setJobPosters(posters);
      }

      // Refresh pending chats
      const pendingChatsResponse = await fetch(`http://localhost:3001/api/chat/pending/${currentUser.user_id}`);
      const pendingChatsResult = await pendingChatsResponse.json();
      if (pendingChatsResult.success) {
        setPendingChats(pendingChatsResult.data);
      }
    } catch (err) {
      console.error('Error refreshing chat lists:', err);
    }
  };

  // Helper to get the best chat for a user (active preferred, otherwise most recent pending)
  function getBestChatForUser(userId: number, activeChats: JobPoster[], pendingChats: PendingChat[]): JobPoster | PendingChat | null {
    // Prefer active chat
    const active = activeChats.find(chat => chat.user_id === userId);
    if (active) return active;
    // Otherwise, pick the most recent pending chat
    const pendings = pendingChats.filter(chat => chat.user_id === userId);
    if (pendings.length > 0) {
      return pendings.reduce((latest, chat) =>
        chat.last_message_time > latest.last_message_time ? chat : latest, pendings[0]);
    }
    return null;
  }

  // Helper to deduplicate JobPoster and PendingChat by user_id, keeping the most recent or active one
  function dedupeJobPosters(chats: JobPoster[]): JobPoster[] {
    const map = new Map<number, JobPoster>();
    chats.forEach(chat => {
      // Only include chats that are actually active (groupchat_status === 1)
      if (chat.groupchat_status !== 1) {
        return;
      }
      
      const existing = map.get(chat.user_id);
      const chatTime = chat.last_message_time || chat.job_posted_date || '';
      const existingTime = existing ? (existing.last_message_time || existing.job_posted_date || '') : '';
      if (!existing) {
        map.set(chat.user_id, chat);
      } else {
        if (chatTime > existingTime) {
          map.set(chat.user_id, chat);
        }
      }
    });
    return Array.from(map.values());
  }
  function dedupePendingChats(chats: PendingChat[]): PendingChat[] {
    const map = new Map<number, PendingChat>();
    chats.forEach(chat => {
      // Only include chats that are actually pending (groupchat_status === 0)
      if (chat.groupchat_status !== 0) {
        return;
      }
      
      const existing = map.get(chat.user_id);
      if (!existing) {
        map.set(chat.user_id, chat);
      } else {
        if (chat.last_message_time > existing.last_message_time) {
          map.set(chat.user_id, chat);
        }
      }
    });
    return Array.from(map.values());
  }

  // Use these helpers for deduplication
  const dedupedJobPosters: JobPoster[] = dedupeJobPosters(jobPosters);
  const dedupedPendingChats: PendingChat[] = dedupePendingChats(pendingChats);

  // Auto-selection logic for stored chat
  useEffect(() => {
    if (loading || autoSelectionPerformedRef.current || !currentUser) {
      return;
    }

    const storedUserId = localStorage.getItem('selectedChatUserId');
    const storedChatType = localStorage.getItem('selectedChatType');
    const storedPendingChatId = localStorage.getItem('selectedPendingChatId');

    if (storedUserId) {
      const targetUserId = parseInt(storedUserId);
      
      if (storedChatType === 'pending' && storedPendingChatId) {
        const pendingChat = dedupedPendingChats.find(chat => 
          chat.user_id === targetUserId && chat.groupchat_id === parseInt(storedPendingChatId)
        );
        
        if (pendingChat) {
          setSelectedPendingChat(pendingChat);
          setActiveTab('pending');
          autoSelectionPerformedRef.current = true;
          return;
        }
      } else {
        // Look for active chat
        const activeChat = dedupedJobPosters.find(poster => poster.user_id === targetUserId);
        
        if (activeChat) {
          setSelectedPoster(activeChat);
          setActiveTab('active');
          autoSelectionPerformedRef.current = true;
          return;
        }
      }

      // If specific chat type not found, find best chat for this user
      const bestChat = getBestChatForUser(targetUserId, dedupedJobPosters, dedupedPendingChats);
      
      if (bestChat) {
        if ('groupchat_id' in bestChat) {
          // It's a pending chat
          setSelectedPendingChat(bestChat);
          setActiveTab('pending');
        } else {
          // It's an active chat
          setSelectedPoster(bestChat);
          setActiveTab('active');
        }
        autoSelectionPerformedRef.current = true;
        return;
      }
    }

    // No stored chat info found, proceed with normal auto-selection
    if (dedupedPendingChats.length > 0) {
      setSelectedPendingChat(dedupedPendingChats[0]);
      setActiveTab('pending');
      autoSelectionPerformedRef.current = true;
    } else if (dedupedJobPosters.length > 0) {
      setSelectedPoster(dedupedJobPosters[0]);
      setActiveTab('active');
      autoSelectionPerformedRef.current = true;
    }
  }, [loading, dedupedJobPosters, dedupedPendingChats, currentUser]);

  // Handle chat status changes - when a pending chat becomes active, switch to active tab
  useEffect(() => {
    if (selectedPendingChat && selectedPendingChat.groupchat_status === 1) {
      // This pending chat has become active, we should switch to active tab
      // But first, we need to find the corresponding active chat
      const activeChat = dedupedJobPosters.find(poster => poster.user_id === selectedPendingChat.user_id);
      if (activeChat) {
        setSelectedPoster(activeChat);
        setSelectedPendingChat(null);
        setActiveTab('active');
      }
    }
  }, [selectedPendingChat, dedupedJobPosters]);

  // Store selected user ID when it changes
  useEffect(() => {
    if (selectedPoster) {
      localStorage.setItem('selectedChatUserId', selectedPoster.user_id.toString());
    }
  }, [selectedPoster]);

  // Join group chat when selected poster changes
  useEffect(() => {
    if (selectedPoster && currentUser && isConnected) {
      // First leave current room, then join new room with a small delay
      socketService.leaveCurrentRoom();
      
      // Add a small delay to ensure room leaving is processed before joining new room
      setTimeout(() => {
        socketService.joinGroupChat(currentUser.user_id, selectedPoster.user_id);
      }, 100);
    }
  }, [selectedPoster, currentUser, isConnected]);

  // Join group chat when selected pending chat changes
  useEffect(() => {
    if (selectedPendingChat && currentUser && isConnected) {
      // First leave current room, then join new room with a small delay
      socketService.leaveCurrentRoom();
      
      // Add a small delay to ensure room leaving is processed before joining new room
      setTimeout(() => {
        socketService.joinGroupChat(currentUser.user_id, selectedPendingChat.user_id);
      }, 100);
    }
  }, [selectedPendingChat, currentUser, isConnected]);

  // Fetch messages when selected poster changes
  useEffect(() => {
    if (selectedPoster && currentUser) {
      // Clear typing indicators when switching users
      setTypingUsers(new Set());
      fetchMessages(selectedPoster.user_id);
    }
  }, [selectedPoster, currentUser]);

  // Fetch messages when selected pending chat changes
  useEffect(() => {
    if (selectedPendingChat && currentUser) {
      // Clear typing indicators when switching users
      setTypingUsers(new Set());
      fetchPendingChatMessages(selectedPendingChat.groupchat_id);
    }
  }, [selectedPendingChat, currentUser]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      socketService.leaveCurrentRoom();
      socketService.offAll();
      // Reset auto-selection flag for next navigation
      autoSelectionPerformedRef.current = false;
    };
  }, []);

  // Cleanup when user changes
  useEffect(() => {
    return () => {
      if (currentUser) {
        socketService.leaveCurrentRoom();
      }
    };
  }, [currentUser]);

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
    }
  };

  const fetchPendingChatMessages = async (groupChatId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/group-chat/${groupChatId}/messages?user_id=${currentUser.user_id}`);
      const result = await response.json();
      
      if (result.success) {
        setMessages(result.data);
        setCurrentGroupChatId(groupChatId);
      } else {
        setMessages([]);
        setCurrentGroupChatId(null);
        setError('Failed to fetch pending chat messages');
      }
    } catch (err) {
      setError('Error fetching pending chat messages');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || (!selectedPoster && !selectedPendingChat) || !currentUser || sendingMessage) {
      return;
    }

    try {
      setSendingMessage(true);
      setSendingText(newMessage.trim());
      setError(null);

      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTyping) {
        setIsTyping(false);
        const socketConnected = socketService.isSocketConnected();
        const targetUserId = selectedPoster?.user_id || selectedPendingChat?.user_id;
        if (socketConnected && targetUserId) {
          socketService.sendTyping(currentUser.user_id, targetUserId, false, currentGroupChatId || undefined);
        }
      }

      const messageContent = newMessage.trim();
      setNewMessage("");

      // Send the original message (no translation for your own messages)
      const messageToSend = messageContent;

      // 2. Send the message to the socket
      const socketConnected = socketService.isSocketConnected();
      if (socketConnected && currentGroupChatId) {
        const targetUserId = selectedPoster?.user_id || selectedPendingChat?.user_id;
        
        // Check if we're in the correct room
        const currentRoom = socketService.getCurrentRoom();
        const expectedRoom = `group-chat-${currentGroupChatId}`;
        
        if (currentRoom !== expectedRoom) {
          console.log(`⚠️ Not in correct room. Current: ${currentRoom}, Expected: ${expectedRoom}`);
          // Join the correct room first
          socketService.joinGroupChat(currentUser.user_id, targetUserId!);
          
          // Wait a bit for room joining, then send message
          setTimeout(() => {
            socketService.sendMessage(
              messageToSend,
              currentUser.user_id,
              targetUserId!,
              currentGroupChatId
            );
            setTimeout(() => { refreshChatLists(); }, 200);
            setSendingMessage(false);
            setSendingText("");
          }, 150);
          return;
        }
        
        socketService.sendMessage(
          messageToSend,
          currentUser.user_id,
          targetUserId!,
          currentGroupChatId
        );
        setTimeout(() => { refreshChatLists(); }, 200);
        setSendingMessage(false);
        setSendingText("");
        return;
      } else {
        // Fallback to HTTP API if socket is not connected
        
        if (selectedPendingChat) {
          // ALWAYS use the pending chat endpoint for pending chats
          const response = await fetch(`http://localhost:3001/api/group-chat/${selectedPendingChat.groupchat_id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message_content: messageToSend,
              user_id: currentUser.user_id
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              // Add the new message to the local state
              const newMessageObj: Message = {
                message_id: result.data.message_id,
                message_content: messageToSend,
                message_time: new Date().toISOString(),
                user_id: currentUser.user_id,
                first_name: currentUser.first_name,
                last_name: currentUser.last_name,
                profile_picture_url: currentUser.profile_picture_url || ''
              };
              setMessages(prev => [...prev, newMessageObj]);

              // Refresh chat lists to update status from pending to active
              setTimeout(() => {
                refreshChatLists();
              }, 200);
            }
          } else {
            throw new Error('Failed to send message via API');
          }
        } else if (selectedPoster) {
          // Only use job-posters endpoint for active chats
          const response = await fetch(`http://localhost:3001/api/job-posters/${selectedPoster.user_id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message_content: messageToSend,
              user_id: currentUser.user_id
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              // Add the new message to the local state
              const newMessageObj: Message = {
                message_id: result.data.message_id,
                message_content: messageToSend,
                message_time: new Date().toISOString(),
                user_id: currentUser.user_id,
                first_name: currentUser.first_name,
                last_name: currentUser.last_name,
                profile_picture_url: currentUser.profile_picture_url || ''
              };
              setMessages(prev => [...prev, newMessageObj]);
            }
          } else {
            throw new Error('Failed to send message via API');
          }
        }
      }
      
    } catch (err) {
      setError('Error sending message');
      setSendingMessage(false);
      setSendingText("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    const socketConnected = socketService.isSocketConnected();
    
    if (!isTyping && selectedPoster && currentUser && socketConnected) {
      setIsTyping(true);
      socketService.sendTyping(currentUser.user_id, selectedPoster.user_id, true, currentGroupChatId || undefined);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && selectedPoster && currentUser && socketConnected) {
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

  // Format message preview
  const formatMessagePreview = (message: string, poster: JobPoster) => {
    if (!message) return '';
    
    const isCurrentUser = poster.last_message_sender_id === currentUser?.user_id;
    const senderName = poster.last_message_sender_first_name && poster.last_message_sender_last_name 
      ? `${poster.last_message_sender_first_name} ${poster.last_message_sender_last_name}`
      : 'Unknown';
    const prefix = isCurrentUser ? 'You' : senderName;
    const maxLength = 50;
    
    if (message.length <= maxLength) {
      return `${prefix}: ${message}`;
    } else {
      return `${prefix}: ${message.substring(0, maxLength)}...`;
    }
  };

  // Function to get user's preferred language
  const getUserPreferredLanguage = async (userId: number): Promise<string> => {
    try {
      const response = await fetch(`http://localhost:3001/api/user/${userId}/preferred-language`);
      const result = await response.json();
      if (result.success) {
        return result.data.preferred_language;
      }
    } catch (error) {
      console.error('Error fetching user preferred language:', error);
    }
    return 'english'; // Default fallback
  };

  // Function to save user's preferred language
  const saveUserPreferredLanguage = async (userId: number, language: string): Promise<boolean> => {
    try {
      const response = await fetch(`http://localhost:3001/api/user/${userId}/preferred-language`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferred_language: language
        }),
      });
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error saving user preferred language:', error);
      return false;
    }
  };

  // Load user's preferred language on component mount
  useEffect(() => {
    const loadUserPreferredLanguage = async () => {
      if (currentUser?.user_id) {
        const userLanguage = await getUserPreferredLanguage(currentUser.user_id);
        setSelectedLanguage(userLanguage);
        setCurrentUserLanguage(userLanguage);
      }
    };
    
    loadUserPreferredLanguage();
  }, [currentUser?.user_id]);

  // Handle language selection change
  const handleLanguageChange = async (language: string) => {
    console.log('Language change requested:', language);
    console.log('Current selectedLanguage:', selectedLanguage);
    
    setSelectedLanguage(language);
    setCurrentUserLanguage(language);
    
    console.log('Language states updated to:', language);
    
    // Save to user's profile
    if (currentUser?.user_id) {
      const success = await saveUserPreferredLanguage(currentUser.user_id, language);
      console.log('Language saved to profile:', success);
    }
  };

  // Function to translate message
  const translateMessage = async (text: string, fromLanguage: string, toLanguage: string): Promise<string> => {
    try {
      const response = await fetch('http://localhost:3001/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          fromLanguage,
          toLanguage
        }),
      });

      const result = await response.json();
      if (result.success) {
        return result.data.translatedText;
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
    return text; // Return original text if translation fails
  };

  // Function to detect language from text content
  const detectLanguage = (text: string): string => {
    // Simple French detection patterns
    const frenchPatterns = [
      /\b(le|la|les|un|une|des|ce|ces|cette|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|votre|leur|leurs)\b/i,
      /\b(et|ou|mais|donc|car|ni|or|puis|ensuite|alors|donc|parce|que|qui|quoi|où|quand|comment|pourquoi)\b/i,
      /\b(je|tu|il|elle|nous|vous|ils|elles|j'ai|tu as|il a|elle a|nous avons|vous avez|ils ont|elles ont)\b/i,
      /\b(suis|es|est|sommes|êtes|sont|était|étaient|serai|seras|sera|serons|serez|seront)\b/i,
      /\b(bonjour|salut|merci|au revoir|oui|non|peut-être|certainement|absolument|exactement)\b/i,
      /\b(comment|pourquoi|quand|où|qui|quoi|combien|quel|quelle|quels|quelles)\b/i,
      /\b(avec|sans|pour|contre|dans|sur|sous|devant|derrière|entre|parmi)\b/i,
      /\b(très|trop|assez|peu|beaucoup|plus|moins|autant|tellement|si|tant)\b/i
    ];
    
    // Check for French patterns
    const frenchMatches = frenchPatterns.filter(pattern => pattern.test(text)).length;
    if (frenchMatches >= 2) {
      return 'french';
    }
    
    // Check for common French words
    const frenchWords = text.toLowerCase().match(/\b(le|la|les|un|une|des|et|ou|mais|je|tu|il|elle|nous|vous|ils|elles|bonjour|merci|oui|non)\b/g);
    if (frenchWords && frenchWords.length >= 2) {
      return 'french';
    }
    
    // Default to English if no clear pattern
    return 'english';
  };

  // Function to translate a message if needed
  const translateMessageIfNeeded = async (message: Message) => {
    // Only translate messages from other users
    if (message.user_id === currentUser?.user_id) {
      return message.message_content;
    }

    // Check if we already translated this message
    if (translatedMessages[message.message_id]) {
      return translatedMessages[message.message_id];
    }

    // Get the sender's preferred language (we'll assume English for now, or you can add it to the message object)
    const senderLanguage = 'english'; // Default assumption
    
    // Only translate if languages are different
    if (senderLanguage !== currentUserLanguage) {
      try {
        console.log(`🔄 Translating message ${message.message_id} from ${senderLanguage} to ${currentUserLanguage}`);
        const translatedText = await translateMessage(message.message_content, senderLanguage, currentUserLanguage);
        
        // Store the translated message
        setTranslatedMessages(prev => ({
          ...prev,
          [message.message_id]: translatedText
        }));
        
        console.log(`✅ Message translated: "${message.message_content}" -> "${translatedText}"`);
        return translatedText;
      } catch (error) {
        console.error('Translation failed:', error);
      }
    }
    
    return message.message_content;
  };

  // Effect to translate messages when they change or user language changes
  useEffect(() => {
    const translateMessages = async () => {
      if (!currentUser || !messages.length) return;
      
      for (const message of messages) {
        // Only translate messages from other users
        if (message.user_id !== currentUser.user_id) {
          // Check if we already translated this message
          if (translatedMessages[message.message_id]) continue;
          
          // Try to get the sender's preferred language
          let senderLanguage = 'english'; // default fallback
          try {
            senderLanguage = await getUserPreferredLanguage(message.user_id);
          } catch (error) {
            console.log('Could not get sender language, trying to detect from text');
            // If we can't get the sender's language, try to detect it from the text
            senderLanguage = detectLanguage(message.message_content);
          }
          
          // Only translate if languages are different
          if (senderLanguage !== currentUserLanguage) {
            try {
              console.log(`🔄 Translating message ${message.message_id} from ${senderLanguage} to ${currentUserLanguage}`);
              const translatedText = await translateMessage(message.message_content, senderLanguage, currentUserLanguage);
              
              // Store the translated message
              setTranslatedMessages(prev => ({
                ...prev,
                [message.message_id]: translatedText
              }));
              
              console.log(`✅ Message translated: "${message.message_content}" -> "${translatedText}"`);
            } catch (error) {
              console.error('Translation failed:', error);
            }
          }
        }
      }
    };
    
    translateMessages();
  }, [messages, currentUserLanguage, currentUser?.user_id]);

  // Function to get display text for a message
  const getMessageDisplayText = (message: Message) => {
    // If it's the current user's message, show original
    if (message.user_id === currentUser?.user_id) {
      return message.message_content;
    }
    
    // If we have a translated version, show it
    if (translatedMessages[message.message_id]) {
      return translatedMessages[message.message_id];
    }
    
    // Otherwise show original
    return message.message_content;
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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => {
                // Store current selected user before navigating
                if (selectedPoster) {
                  localStorage.setItem('selectedChatUserId', selectedPoster.user_id.toString());
                }
                // Clear cached job post when navigating away
                localStorage.removeItem('selectedChatJobPost');
                // Clear chat selection info when navigating away
                localStorage.removeItem('selectedChatType');
                localStorage.removeItem('selectedPendingChatId');
                navigate('/');
              }}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Jobs</span>
            </Button>
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">JB</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">JobBoard</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search jobs..."
                className="pl-10 w-80"
                disabled
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={() => navigate('/post-job')} className="bg-blue-600 hover:bg-blue-700">
              Post a Job
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
                <Button onClick={() => {
                  logoutUser();
                  navigate('/');
                }} variant="outline" size="sm">
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

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex justify-center">
        <div className="max-w-7xl w-full flex-1 min-h-0 flex px-6 py-6">
          {/* Contacts List */}
          <div className="w-full lg:w-1/3 max-w-md flex flex-col h-full min-h-0 pr-6">
            <Card className="h-full flex flex-col">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="p-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Contacts</h2>
                    <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                      <SelectTrigger className="w-32">
                        <div className="flex items-center">
                          <span className="mr-2 text-lg">
                            {getFlagImage(selectedLanguage)}
                          </span>
                          <span className="truncate text-sm">
                            {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {SUPPORTED_LANGUAGES.map((language) => (
                          <SelectItem key={language.code} value={language.code}>
                            <div className="flex items-center">
                              <span className="mr-2 text-lg">
                                {getFlagImage(language.code)}
                              </span>
                              <span>{language.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b">
                  <button
                    className={`flex-1 px-4 py-2 text-sm font-medium ${
                      activeTab === 'active' 
                        ? 'text-blue-600 border-b-2 border-blue-600' 
                        : dedupedJobPosters.length === 0
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => {
                      if (dedupedJobPosters.length > 0) {
                        setActiveTab('active');
                      }
                    }}
                    disabled={dedupedJobPosters.length === 0}
                  >
                    Active ({dedupedJobPosters.length})
                  </button>
                  <button
                    className={`flex-1 px-4 py-2 text-sm font-medium ${
                      activeTab === 'pending' 
                        ? 'text-blue-600 border-b-2 border-blue-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab('pending')}
                  >
                    Pending ({dedupedPendingChats.length})
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                  {activeTab === 'active' ? (
                    // Active chats
                    dedupedJobPosters.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <p className="text-sm">No active chats</p>
                        <p className="text-xs mt-1">Start conversations by contacting job posters</p>
                      </div>
                    ) : (
                      dedupedJobPosters.map((poster) => (
                        <div key={poster.user_id}>
                          <div 
                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                              selectedPoster?.user_id === poster.user_id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                            }`}
                            onClick={() => {
                              setSelectedPoster(poster);
                              setSelectedPendingChat(null);
                              setActiveTab('active');
                              // Store the selected active chat info
                              localStorage.setItem('selectedChatType', 'active');
                              localStorage.setItem('selectedChatUserId', poster.user_id.toString());
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              <UserAvatar firstName={poster.first_name} lastName={poster.last_name} profilePictureUrl={poster.profile_picture_url} size={40} />
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
                                  Job Poster
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  {poster.last_message ? 
                                    formatMessagePreview(poster.last_message, poster) :
                                    'No messages yet'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                          <Separator />
                        </div>
                      ))
                    )
                  ) : (
                    // Pending chats
                    dedupedPendingChats.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <p className="text-sm">No pending chats</p>
                        <p className="text-xs mt-1">Pending chats will appear here</p>
                      </div>
                    ) : (
                      dedupedPendingChats.map((chat) => (
                        <div key={chat.groupchat_id}>
                          <div 
                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                              selectedPendingChat?.groupchat_id === chat.groupchat_id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                            }`}
                            onClick={() => {
                              setSelectedPendingChat(chat);
                              setSelectedPoster(null);
                              setActiveTab('pending');
                              // Store the selected pending chat info
                              localStorage.setItem('selectedChatType', 'pending');
                              localStorage.setItem('selectedChatUserId', chat.user_id.toString());
                              localStorage.setItem('selectedPendingChatId', chat.groupchat_id.toString());
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              <UserAvatar firstName={chat.first_name} lastName={chat.last_name} profilePictureUrl={chat.profile_picture_url} size={40} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <h3 className="font-medium text-gray-900 truncate">
                                      {chat.first_name} {chat.last_name}
                                    </h3>
                                    {chat.groupchat_status === 0 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                    {formatDate(chat.last_message_time)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 truncate mt-1">
                                  {chat.last_message}
                                </p>
                              </div>
                            </div>
                          </div>
                          <Separator />
                        </div>
                      ))
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Module */}
          <div className="flex-1 min-w-0 flex flex-col h-full">
            {(selectedPoster || selectedPendingChat) ? (
              <Card className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <UserAvatar firstName={selectedPoster?.first_name || selectedPendingChat?.first_name} lastName={selectedPoster?.last_name || selectedPendingChat?.last_name} profilePictureUrl={selectedPoster?.profile_picture_url || selectedPendingChat?.profile_picture_url} size={40} />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 truncate">
                            {selectedPoster?.first_name || selectedPendingChat?.first_name} {selectedPoster?.last_name || selectedPendingChat?.last_name}
                          </h3>
                          {selectedPendingChat && selectedPendingChat.groupchat_status === 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {selectedPoster ? 'Job Poster' : 'Pending Chat'}
                        </p>
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
                        <p className="text-lg font-medium mb-2">
                          {selectedPendingChat ? 'Pending Chat' : 'No messages yet'}
                        </p>
                        <p className="text-sm">
                          {selectedPendingChat 
                            ? 'This chat is pending. Send a message to start the conversation!'
                            : 'Start a conversation by sending a message!'
                          }
                        </p>
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
                            <p className="text-sm break-words">{getMessageDisplayText(message)}</p>
                            <div className={`flex items-center justify-between text-xs mt-1 ${
                              message.user_id === currentUser.user_id ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              <span>
                                {formatDate(message.message_time)}
                              </span>
                              {message.user_id !== currentUser.user_id && translatedMessages[message.message_id] && (
                                <span className="ml-2 text-xs opacity-75 flex items-center">
                                  <span className="mr-1">{getFlagImage(currentUserLanguage, 12)}</span>
                                  Translated
                                </span>
                              )}
                            </div>
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
                      disabled={!selectedPoster && !selectedPendingChat || !isConnected}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={!selectedPoster && !selectedPendingChat || !newMessage.trim() || !isConnected || sendingMessage}
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
                  <p className="text-sm">Choose a job poster or pending chat from the list to start chatting</p>
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
