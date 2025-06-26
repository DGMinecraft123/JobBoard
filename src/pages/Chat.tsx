
import { useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';

// Mock chat data
const mockContacts = [
  {
    id: 1,
    name: "Maria Nguyen",
    jobTitle: "Store Manager - Thien Huong Sandwiches",
    avatar: "/api/placeholder/40/40",
    lastMessage: "You: Dạ em cám ơn chị",
    timestamp: "2 mins ago",
    unread: true
  },
  {
    id: 2,
    name: "Sarah Chen",
    jobTitle: "Engineering Manager - Primera",
    avatar: "/api/placeholder/40/40",
    lastMessage: "Sarah: When can you start?",
    timestamp: "1 hour ago",
    unread: false
  },
  {
    id: 3,
    name: "David Kim",
    jobTitle: "Restaurant Manager - The Garden Restaurant",
    avatar: "/api/placeholder/40/40",
    lastMessage: "You: I'm interested in the position",
    timestamp: "3 hours ago",
    unread: false
  }
];

const mockMessages = [
  {
    id: 1,
    senderId: 1,
    senderName: "Maria Nguyen",
    message: "Hi! Thanks for your interest in the cashier position. Are you available for an interview?",
    timestamp: "10:30 AM",
    isOwn: false
  },
  {
    id: 2,
    senderId: "me",
    senderName: "You",
    message: "Yes, I'm available. What time works best for you?",
    timestamp: "10:35 AM",
    isOwn: true
  },
  {
    id: 3,
    senderId: 1,
    senderName: "Maria Nguyen",
    message: "How about tomorrow at 2 PM?",
    timestamp: "10:40 AM",
    isOwn: false
  },
  {
    id: 4,
    senderId: "me",
    senderName: "You",
    message: "Dạ em cám ơn chị",
    timestamp: "10:42 AM",
    isOwn: true
  }
];

const Chat = () => {
  const [selectedContact, setSelectedContact] = useState(mockContacts[0]);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState(mockMessages);
  const navigate = useNavigate();

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: messages.length + 1,
        senderId: "me",
        senderName: "You",
        message: newMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOwn: true
      };
      setMessages([...messages, message]);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
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

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Contacts List */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardContent className="p-0">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">Contacts</h2>
                </div>
                <div className="overflow-y-auto h-full">
                  {mockContacts.map((contact) => (
                    <div key={contact.id}>
                      <div 
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedContact.id === contact.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                        }`}
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-start space-x-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.avatar} alt={contact.name} />
                            <AvatarFallback>
                              {contact.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-gray-900 truncate">
                                {contact.name}
                              </h3>
                              <span className="text-xs text-gray-500">
                                {contact.timestamp}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 truncate mb-1">
                              {contact.jobTitle}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {contact.lastMessage}
                            </p>
                          </div>
                          {contact.unread && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Module */}
          <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} />
                    <AvatarFallback>
                      {selectedContact.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedContact.name}</h3>
                    <p className="text-sm text-gray-600">{selectedContact.jobTitle}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.isOwn 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      <p className="text-sm">{message.message}</p>
                      <p className={`text-xs mt-1 ${
                        message.isOwn ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
