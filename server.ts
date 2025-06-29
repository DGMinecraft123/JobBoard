import 'dotenv/config';
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { testConnection, executeQuery, getRow, insertData, updateData, deleteData } from './src/lib/database';
import { spawn } from 'child_process';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Performance monitoring
const performanceStats = {
  messageCount: 0,
  totalMessageTime: 0,
  averageMessageTime: 0,
  lastMessageTime: 0
};

// Update performance stats
const updatePerformanceStats = (messageTime: number) => {
  performanceStats.messageCount++;
  performanceStats.totalMessageTime += messageTime;
  performanceStats.averageMessageTime = performanceStats.totalMessageTime / performanceStats.messageCount;
  performanceStats.lastMessageTime = messageTime;
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a group chat room
  socket.on('join-group-chat', async (data: { userId: number, posterId: number }) => {
    try {
      const { userId, posterId } = data;
      
      // Leave current room if any
      if (socket.data.currentRoom) {
        console.log(`User ${userId} leaving room: ${socket.data.currentRoom}`);
        socket.leave(socket.data.currentRoom);
        socket.data.currentRoom = null;
      }
      
      // Find the group chat that both users are part of
      const groupChat = await getRow(`
        SELECT j1.groupchat_id
        FROM joins j1
        JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
        WHERE j1.user_id = ? AND j2.user_id = ?
        LIMIT 1
      `, [userId, posterId]);

      if (groupChat) {
        const roomName = `group-chat-${groupChat.groupchat_id}`;
        socket.join(roomName);
        socket.data.currentRoom = roomName;
        socket.data.userId = userId;
        console.log(`User ${userId} joined room: ${roomName}`);
        
        // Send confirmation to client
        socket.emit('room-joined', { roomName, groupChatId: groupChat.groupchat_id });
      } else {
        console.log(`No group chat found for user ${userId} and poster ${posterId}`);
        socket.emit('room-join-error', { message: 'No group chat found between these users' });
      }
    } catch (error) {
      console.error('Error joining group chat:', error);
      socket.emit('room-join-error', { message: 'Failed to join group chat' });
    }
  });

  // Handle new message
  socket.on('send-message', async (data: { 
    messageContent: string, 
    userId: number, 
    posterId: number,
    groupChatId?: number 
  }) => {
    const startTime = Date.now();
    
    try {
      const { messageContent, userId, posterId, groupChatId } = data;
      let targetGroupChatId = groupChatId;

      // If groupChatId is not provided, find it (optimized query)
      if (!targetGroupChatId) {
        // Optimized query with better indexing
        const groupChat = await getRow(`
          SELECT DISTINCT j1.groupchat_id
          FROM joins j1
          INNER JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
          WHERE j1.user_id = ? AND j2.user_id = ?
          LIMIT 1
        `, [userId, posterId]);

        if (!groupChat) {
          socket.emit('error', { message: 'No group chat found between these users' });
          return;
        }
        targetGroupChatId = groupChat.groupchat_id;
      }

      // Optimize: Perform database operations in parallel where possible
      const [messageId, user] = await Promise.all([
        // Insert the original message into database (no translation here)
        insertData(
          'INSERT INTO messages (message_content, message_time) VALUES (?, NOW())',
          [messageContent]
        ),
        // Get user info for the message (parallel with message insertion)
        getRow(
          'SELECT user_id, first_name, last_name, profile_picture_url FROM users WHERE user_id = ?',
          [userId]
        )
      ]);

      // Create the relationship in contains table
      await insertData(
        'INSERT INTO contains (user_id, groupchat_id, message_id) VALUES (?, ?, ?)',
        [userId, targetGroupChatId, messageId]
      );

      // Optimize: Update groupchat status and get message info in parallel
      const [updateResult, message] = await Promise.all([
        // Update groupchat status from pending (0) to active (1)
        executeQuery('UPDATE groupchat SET groupchat_status=1 WHERE groupchat_id=? AND groupchat_status=0', [targetGroupChatId]),
        // Get the message with timestamp (parallel with status update)
        getRow(
          'SELECT message_id, message_content, message_time FROM messages WHERE message_id = ?',
          [messageId]
        )
      ]);

      // Only perform additional status update if needed (optimized)
      if (updateResult.affectedRows === 0) {
        // Check if there are any messages in this group chat
        const messageCount = await getRow('SELECT COUNT(*) as count FROM contains WHERE groupchat_id = ?', [targetGroupChatId]);
        
        if (messageCount.count > 1) { // Changed from > 0 to > 1 since we just added a message
          await executeQuery('UPDATE groupchat SET groupchat_status=1 WHERE groupchat_id=?', [targetGroupChatId]);
        }
      }

      const messageData = {
        message_id: message.message_id,
        message_content: message.message_content,
        message_time: message.message_time,
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture_url: user.profile_picture_url
      };

      // Emit the message to all users in the group chat room
      const roomName = `group-chat-${targetGroupChatId}`;
      io.to(roomName).emit('new-message', messageData);

      // Emit chat list update to all users in the room
      const chatListUpdate = {
        groupChatId: targetGroupChatId,
        lastMessage: messageData.message_content,
        lastMessageTime: messageData.message_time,
        senderId: messageData.user_id,
        senderName: `${messageData.first_name} ${messageData.last_name}`
      };
      io.to(roomName).emit('chat-list-update', chatListUpdate);

      // Update performance stats
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      updatePerformanceStats(processingTime);
      console.log(`⚡ Message processed in ${processingTime}ms (Avg: ${performanceStats.averageMessageTime.toFixed(2)}ms)`);
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicator
  socket.on('typing', async (data: { 
    userId: number, 
    posterId: number, 
    isTyping: boolean,
    groupChatId?: number 
  }) => {
    try {
      const { userId, posterId, isTyping, groupChatId } = data;
      let targetGroupChatId = groupChatId;

      // If groupChatId is not provided, find it
      if (!targetGroupChatId) {
        const groupChat = await getRow(`
          SELECT j1.groupchat_id
          FROM joins j1
          JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
          WHERE j1.user_id = ? AND j2.user_id = ?
          LIMIT 1
        `, [userId, posterId]);

        if (!groupChat) {
          return;
        }
        targetGroupChatId = groupChat.groupchat_id;
      }

      // Emit typing indicator to all users in the group chat room (except sender)
      const roomName = `group-chat-${targetGroupChatId}`;
      socket.to(roomName).emit('user-typing', { userId, isTyping });

      console.log(`Typing indicator in room ${roomName}: User ${userId} ${isTyping ? 'started' : 'stopped'} typing`);
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  });

  // Handle leaving room
  socket.on('leave-room', () => {
    if (socket.data.currentRoom) {
      console.log(`User ${socket.data.userId} leaving room: ${socket.data.currentRoom}`);
      socket.leave(socket.data.currentRoom);
      socket.data.currentRoom = null;
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Test database connection
app.get('/api/test', async (req, res) => {
  try {
    await testConnection();
    res.json({ success: true, message: 'Database connection successful' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Optimize database for socket performance
app.get('/api/optimize-db', async (req, res) => {
  try {
    // Create indexes for better socket performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_joins_user_groupchat ON joins(user_id, groupchat_id)',
      'CREATE INDEX IF NOT EXISTS idx_contains_groupchat_message ON contains(groupchat_id, message_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(message_time)',
      'CREATE INDEX IF NOT EXISTS idx_groupchat_status ON groupchat(groupchat_status)',
      'CREATE INDEX IF NOT EXISTS idx_users_id ON users(user_id)'
    ];

    for (const indexQuery of indexes) {
      try {
        await executeQuery(indexQuery);
      } catch (error) {
        console.log('Index might already exist:', error);
      }
    }

    res.json({ success: true, message: 'Database optimized for socket performance' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database optimization failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get socket performance statistics
app.get('/api/socket-performance', (req, res) => {
  res.json({
    success: true,
    data: {
      messageCount: performanceStats.messageCount,
      averageMessageTime: performanceStats.averageMessageTime.toFixed(2) + 'ms',
      lastMessageTime: performanceStats.lastMessageTime + 'ms',
      totalMessageTime: performanceStats.totalMessageTime + 'ms'
    }
  });
});

// Get all job posts
app.get('/api/jobposts', async (req, res) => {
  try {
    const { sortDate, search } = req.query;
    
    let orderClause = 'ORDER BY j.date DESC';
    if (sortDate === 'asc') {
      orderClause = 'ORDER BY j.date ASC';
    } else if (sortDate === 'desc') {
      orderClause = 'ORDER BY j.date DESC';
    }
    
    let whereClause = '';
    let params: any[] = [];
    
    if (search) {
      whereClause = 'WHERE j.title LIKE ? OR j.description LIKE ? OR j.name LIKE ? OR j.location LIKE ?';
      const searchTerm = `%${search}%`;
      params = [searchTerm, searchTerm, searchTerm, searchTerm];
    }
    
    const jobPosts = await executeQuery(`
      SELECT 
        j.jobpost_id,
        j.title,
        j.name,
        j.location,
        j.date,
        j.description,
        j.pictures_url,
        j.qualifications,
        j.salary,
        u.first_name,
        u.last_name,
        u.profile_picture_url,
        u.user_id
      FROM jobpost j
      LEFT JOIN posts p ON j.jobpost_id = p.jobpost_id
      LEFT JOIN users u ON p.user_id = u.user_id
      ${whereClause}
      ${orderClause}
    `, params);
    
    res.json({ success: true, data: jobPosts });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job posts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job post by ID
app.get('/api/jobposts/:id', async (req, res) => {
  try {
    const jobPost = await getRow(`
      SELECT 
        j.jobpost_id,
        j.title,
        j.name,
        j.location,
        j.date,
        j.description,
        j.pictures_url,
        j.qualifications,
        j.salary,
        u.first_name,
        u.last_name,
        u.profile_picture_url,
        u.user_id
      FROM jobpost j
      LEFT JOIN posts p ON j.jobpost_id = p.jobpost_id
      LEFT JOIN users u ON p.user_id = u.user_id
      WHERE j.jobpost_id = ?
    `, [req.params.id]);
    if (jobPost) {
      res.json({ success: true, data: jobPost });
    } else {
      res.status(404).json({ success: false, message: 'Job post not found' });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a new job post
app.post('/api/jobposts', async (req: any, res: any) => {
  try {
    const { title, name, location, description, pictures_url, qualifications, salary } = req.body;
    
    if (!title || !name) {
      return res.status(400).json({
        success: false,
        message: 'Title and company name are required'
      });
    }

    // Insert into jobpost table
    const jobpostId = await insertData(
      'INSERT INTO jobpost (title, name, location, date, description, pictures_url, qualifications, salary) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)',
      [title, name, location || 'Location TBD', description || 'No description provided', pictures_url || '', qualifications || 'To be determined', salary || 'Salary TBD']
    );

    res.json({
      success: true,
      message: 'Job post created successfully',
      data: { jobpost_id: jobpostId }
    });
  } catch (error) {
    console.error('Error creating job post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a post relationship (link user to job post)
app.post('/api/posts', async (req: any, res: any) => {
  try {
    const { user_id, jobpost_id } = req.body;
    
    if (!user_id || !jobpost_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Job Post ID are required'
      });
    }

    // Insert into posts table
    await insertData(
      'INSERT INTO posts (user_id, jobpost_id) VALUES (?, ?)',
      [user_id, jobpost_id]
    );

    res.json({
      success: true,
      message: 'Post relationship created successfully'
    });
  } catch (error) {
    console.error('Error creating post relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post relationship',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update job post
app.put('/api/jobposts/:id', async (req, res) => {
  try {
    const { title, name, location, description, pictures_url, qualifications, salary } = req.body;
    const jobpostId = req.params.id;
    
    await updateData(
      'UPDATE jobpost SET title = ?, name = ?, location = ?, description = ?, pictures_url = ?, qualifications = ?, salary = ? WHERE jobpost_id = ?',
      [title, name, location, description, pictures_url, qualifications, salary, jobpostId]
    );
    
    res.json({ success: true, message: 'Job post updated successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update job post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete job post
app.delete('/api/jobposts/:id', async (req, res) => {
  try {
    const jobpostId = req.params.id;
    
    // Delete related records first
    await deleteData('DELETE FROM posts WHERE jobpost_id = ?', [jobpostId]);
    await deleteData('DELETE FROM jobpost WHERE jobpost_id = ?', [jobpostId]);
    
    res.json({ success: true, message: 'Job post deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete job post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// User registration
app.post('/api/auth/register', async (req: any, res: any) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await getRow('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new user (without preferred_language)
    const userId = await insertData(
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      [first_name, last_name, email, hashedPassword]
    );
    
    // Update profile_picture_url with the actual user_id
    await updateData(
      'UPDATE users SET profile_picture_url = ? WHERE user_id = ?',
      [`profile_picture/${userId}`, userId]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          user_id: userId,
          first_name,
          last_name,
          email,
          profile_picture_url: `profile_picture/${userId}`
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// User login
app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    
    // Get user by email
    const user = await getRow('SELECT user_id, first_name, last_name, email, password, profile_picture_url FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          profile_picture_url: user.profile_picture_url
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Verify JWT token middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Get current user profile
app.get('/api/auth/profile', authenticateToken, async (req: any, res: any) => {
  try {
    const user = await getRow('SELECT user_id, first_name, last_name, email, profile_picture_url FROM users WHERE user_id = ?', [req.user.userId]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job posters for chat interface
app.get('/api/job-posters', async (req, res): Promise<void> => {
  try {
    const { user_id } = req.query; // Get user_id from query parameter
    
    if (!user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    const jobPosters = await executeQuery(`
      SELECT DISTINCT
        u.user_id,
        u.first_name,
        u.last_name,
        u.profile_picture_url,
        j.jobpost_id,
        j.title as job_title,
        j.location as company_location,
        j.date as job_posted_date,
        gc.groupchat_status,
        lm.message_content as last_message,
        lm.message_time as last_message_time,
        lm.sender_user_id as last_message_sender_id,
        lm.sender_first_name as last_message_sender_first_name,
        lm.sender_last_name as last_message_sender_last_name
      FROM users u
      JOIN joins jo ON u.user_id = jo.user_id
      LEFT JOIN posts p ON u.user_id = p.user_id
      LEFT JOIN jobpost j ON p.jobpost_id = j.jobpost_id
      LEFT JOIN groupchat gc ON jo.groupchat_id = gc.groupchat_id
      LEFT JOIN (
        SELECT 
          c.groupchat_id,
          m.message_content,
          m.message_time,
          c.user_id as sender_user_id,
          u.first_name as sender_first_name,
          u.last_name as sender_last_name
        FROM messages m
        JOIN contains c ON m.message_id = c.message_id
        JOIN users u ON c.user_id = u.user_id
        WHERE (c.groupchat_id, m.message_time) IN (
          SELECT 
            c2.groupchat_id,
            MAX(m2.message_time)
          FROM messages m2
          JOIN contains c2 ON m2.message_id = c2.message_id
          GROUP BY c2.groupchat_id
        )
      ) lm ON jo.groupchat_id = lm.groupchat_id
      WHERE jo.groupchat_id IN (
        SELECT groupchat_id 
        FROM joins 
        WHERE user_id = ?
      )
      AND u.user_id != ?
      ORDER BY j.date DESC
    `, [user_id, user_id]);
    res.json({ success: true, data: jobPosters });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job posters',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get messages for a specific job poster
app.get('/api/job-posters/:posterId/messages', async (req, res) => {
  try {
    const { posterId } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    const messages = await executeQuery(`
      SELECT 
        m.message_id,
        m.message_content,
        m.message_time,
        c.user_id,
        u.first_name,
        u.last_name,
        u.profile_picture_url
      FROM messages m
      JOIN contains c ON m.message_id = c.message_id
      JOIN users u ON c.user_id = u.user_id
      WHERE c.groupchat_id IN (
        SELECT j1.groupchat_id
        FROM joins j1
        JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
        WHERE j1.user_id = ? AND j2.user_id = ?
      )
      ORDER BY m.message_time ASC
    `, [user_id, posterId]);

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send message to a job poster
app.post('/api/job-posters/:posterId/messages', async (req: any, res: any) => {
  try {
    const { posterId } = req.params;
    const { message_content, user_id } = req.body;
    
    if (!message_content || !user_id) {
      res.status(400).json({
        success: false,
        message: 'Message content and user ID are required'
      });
      return;
    }

    // Get sender's preferred language
    const sender = await getRow('SELECT preferred_language FROM users WHERE user_id = ?', [user_id]);
    const senderLanguage = sender?.preferred_language || 'english';

    // Get receiver's preferred language
    const receiver = await getRow('SELECT preferred_language FROM users WHERE user_id = ?', [posterId]);
    const receiverLanguage = receiver?.preferred_language || 'english';

    // Store the original message (no translation here)
    let messageToStore = message_content;

    // Find or create group chat
    let groupChat = await getRow(`
      SELECT j1.groupchat_id
      FROM joins j1
      JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
      WHERE j1.user_id = ? AND j2.user_id = ?
      LIMIT 1
    `, [user_id, posterId]);

    if (!groupChat) {
      // Create new group chat
      const groupChatId = await insertData(
        'INSERT INTO groupchat (groupchat_name, groupchat_status) VALUES (?, ?)',
        [`Chat between user ${user_id} and ${posterId}`, 1]
      );
      
      // Add both users to the group chat
      await insertData('INSERT INTO joins (user_id, groupchat_id) VALUES (?, ?)', [user_id, groupChatId]);
      await insertData('INSERT INTO joins (user_id, groupchat_id) VALUES (?, ?)', [posterId, groupChatId]);
      
      groupChat = { groupchat_id: groupChatId };
    }

    // Insert the translated message
    const messageId = await insertData(
      'INSERT INTO messages (message_content, message_time) VALUES (?, NOW())',
      [messageToStore]
    );

    // Create the relationship in contains table
    await insertData(
      'INSERT INTO contains (user_id, groupchat_id, message_id) VALUES (?, ?, ?)',
      [user_id, groupChat.groupchat_id, messageId]
    );

    // Update groupchat status to active if it was pending
    await executeQuery('UPDATE groupchat SET groupchat_status=1 WHERE groupchat_id=? AND groupchat_status=0', [groupChat.groupchat_id]);

    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      data: { 
        message_id: messageId,
        originalMessage: message_content,
        translatedMessage: messageToStore,
        fromLanguage: senderLanguage,
        toLanguage: receiverLanguage
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get group chat ID for a user pair
app.get('/api/job-posters/:posterId/group-chat', async (req, res) => {
  try {
    const { posterId } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    const groupChat = await getRow(`
      SELECT j1.groupchat_id
      FROM joins j1
      JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
      WHERE j1.user_id = ? AND j2.user_id = ?
      LIMIT 1
    `, [user_id, posterId]);

    if (groupChat) {
      res.json({ success: true, data: groupChat });
    } else {
      res.status(404).json({ success: false, message: 'No group chat found' });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get group chat',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get pending chats for a user
app.get('/api/chat/pending/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pendingChats = await executeQuery(`
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.profile_picture_url,
        gc.groupchat_id,
        gc.groupchat_name,
        gc.groupchat_status,
        COALESCE(lm.message_content, '') as last_message,
        COALESCE(lm.message_time, NOW()) as last_message_time
      FROM users u
      JOIN joins j ON u.user_id = j.user_id
      JOIN groupchat gc ON j.groupchat_id = gc.groupchat_id
      LEFT JOIN (
        SELECT 
          c.groupchat_id,
          m.message_content,
          m.message_time
        FROM messages m
        JOIN contains c ON m.message_id = c.message_id
        WHERE (c.groupchat_id, m.message_time) IN (
          SELECT 
            c2.groupchat_id,
            MAX(m2.message_time)
          FROM messages m2
          JOIN contains c2 ON m2.message_id = c2.message_id
          GROUP BY c2.groupchat_id
        )
      ) lm ON gc.groupchat_id = lm.groupchat_id
      WHERE gc.groupchat_id IN (
        SELECT groupchat_id 
        FROM joins 
        WHERE user_id = ?
      )
      AND gc.groupchat_status = 0
      AND u.user_id != ?
      ORDER BY lm.message_time DESC, gc.groupchat_id DESC
    `, [userId, userId]);

    res.json({ success: true, data: pendingChats });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending chats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get messages for a specific group chat
app.get('/api/group-chat/:groupChatId/messages', async (req, res) => {
  try {
    const { groupChatId } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // Verify user is part of this group chat
    const membership = await getRow(
      'SELECT user_id FROM joins WHERE user_id = ? AND groupchat_id = ?',
      [user_id, groupChatId]
    );

    if (!membership) {
      res.status(403).json({
        success: false,
        message: 'You are not a member of this group chat'
      });
      return;
    }

    const messages = await executeQuery(`
      SELECT 
        m.message_id,
        m.message_content,
        m.message_time,
        c.user_id,
        u.first_name,
        u.last_name,
        u.profile_picture_url
      FROM messages m
      JOIN contains c ON m.message_id = c.message_id
      JOIN users u ON c.user_id = u.user_id
      WHERE c.groupchat_id = ?
      ORDER BY m.message_time ASC
    `, [groupChatId]);

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send message to a specific group chat
app.post('/api/group-chat/:groupChatId/messages', async (req: any, res: any) => {
  try {
    const { groupChatId } = req.params;
    const { message_content, user_id } = req.body;
    
    if (!message_content || !user_id) {
      res.status(400).json({
        success: false,
        message: 'Message content and user ID are required'
      });
      return;
    }

    // Verify user is part of this group chat
    const membership = await getRow(
      'SELECT user_id FROM joins WHERE user_id = ? AND groupchat_id = ?',
      [user_id, groupChatId]
    );

    if (!membership) {
      res.status(403).json({
        success: false,
        message: 'You are not a member of this group chat'
      });
      return;
    }

    // Get all users in this group chat
    const groupMembers = await executeQuery(
      'SELECT user_id FROM joins WHERE groupchat_id = ?',
      [groupChatId]
    );

    // Get sender's preferred language
    const sender = await getRow('SELECT preferred_language FROM users WHERE user_id = ?', [user_id]);
    const senderLanguage = sender?.preferred_language || 'english';

    // Get receiver's preferred language (assuming 2-person chat)
    const receiverId = groupMembers.find((member: any) => member.user_id !== user_id)?.user_id;
    let messageToStore = message_content;
    
    if (receiverId) {
      const receiver = await getRow('SELECT preferred_language FROM users WHERE user_id = ?', [receiverId]);
      const receiverLanguage = receiver?.preferred_language || 'english';

      // Store the original message (no translation here)
      messageToStore = message_content;
    }

    // Insert the translated message
    const messageId = await insertData(
      'INSERT INTO messages (message_content, message_time) VALUES (?, NOW())',
      [messageToStore]
    );

    // Create the relationship in contains table
    await insertData(
      'INSERT INTO contains (user_id, groupchat_id, message_id) VALUES (?, ?, ?)',
      [user_id, groupChatId, messageId]
    );

    // Update groupchat status to active if it was pending
    await executeQuery('UPDATE groupchat SET groupchat_status=1 WHERE groupchat_id=? AND groupchat_status=0', [groupChatId]);

    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      data: { 
        message_id: messageId,
        originalMessage: message_content,
        translatedMessage: messageToStore
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create pending chat
app.post('/api/chat/pending', async (req, res) => {
  try {
    const { user_id, target_user_id } = req.body;
    
    if (!user_id || !target_user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID and target user ID are required'
      });
      return;
    }

    // Check if a group chat already exists between these users
    const existingChat = await getRow(`
      SELECT j1.groupchat_id
      FROM joins j1
      JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
      WHERE j1.user_id = ? AND j2.user_id = ?
      LIMIT 1
    `, [user_id, target_user_id]);

    if (existingChat) {
      res.status(400).json({
        success: false,
        message: 'A chat already exists between these users'
      });
      return;
    }

    // Create new pending group chat
    const groupChatId = await insertData(
      'INSERT INTO groupchat (groupchat_name, groupchat_status) VALUES (?, ?)',
      [`Pending chat between user ${user_id} and ${target_user_id}`, 0]
    );
    
    // Add both users to the group chat
    await insertData('INSERT INTO joins (user_id, groupchat_id) VALUES (?, ?)', [user_id, groupChatId]);
    await insertData('INSERT INTO joins (user_id, groupchat_id) VALUES (?, ?)', [target_user_id, groupChatId]);

    res.json({ 
      success: true, 
      message: 'Pending chat created successfully',
      data: { groupchat_id: groupChatId }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create pending chat',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cleanup endpoint to remove system messages from pending chats
app.delete('/api/chat/cleanup-system-messages', async (req, res) => {
  try {
    // Delete system messages from pending chats
    const result = await executeQuery(`
      DELETE m FROM messages m
      JOIN contains c ON m.message_id = c.message_id
      JOIN groupchat gc ON c.groupchat_id = gc.groupchat_id
      WHERE gc.groupchat_status = 0 
      AND m.message_content = 'Chat initiated. Waiting for response...'
    `);

    res.json({ 
      success: true, 
      message: 'System messages cleaned up successfully',
      data: { deletedCount: result.affectedRows }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cleanup system messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cleanup endpoint to remove duplicate group chats
app.delete('/api/chat/cleanup-duplicates', async (req, res) => {
  try {
    // Find and delete duplicate group chats
    const result = await executeQuery(`
      DELETE gc FROM groupchat gc
      WHERE gc.groupchat_id IN (
        SELECT groupchat_id FROM (
          SELECT gc2.groupchat_id
          FROM groupchat gc2
          JOIN joins j1 ON gc2.groupchat_id = j1.groupchat_id
          JOIN joins j2 ON gc2.groupchat_id = j2.groupchat_id
          WHERE j1.user_id != j2.user_id
          GROUP BY j1.user_id, j2.user_id
          HAVING COUNT(*) > 1
        ) AS duplicates
      )
    `);

    res.json({ 
      success: true, 
      message: 'Duplicate group chats cleaned up successfully',
      data: { deletedCount: result.affectedRows }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cleanup duplicate group chats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user's posted jobs
app.get('/api/my-jobs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const jobs = await executeQuery(`
      SELECT 
        j.jobpost_id,
        j.title,
        j.name,
        j.location,
        j.date,
        j.description,
        j.pictures_url,
        j.qualifications,
        j.salary,
        u.first_name,
        u.last_name,
        u.profile_picture_url,
        u.user_id
      FROM jobpost j
      JOIN posts p ON j.jobpost_id = p.jobpost_id
      JOIN users u ON p.user_id = u.user_id
      WHERE p.user_id = ?
      ORDER BY j.date DESC
    `, [userId]);

    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user jobs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get applications for a specific job
app.get('/api/applications/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const applications = await executeQuery(`
      SELECT 
        a.user_id,
        a.jobpost_id,
        a.applied_date,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture_url
      FROM applies a
      JOIN users u ON a.user_id = u.user_id
      WHERE a.jobpost_id = ?
      ORDER BY a.applied_date DESC
    `, [jobId]);

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch applications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get applications for a specific user
app.get('/api/applications/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const applications = await executeQuery(`
      SELECT 
        a.user_id,
        a.jobpost_id,
        a.applied_date,
        j.jobpost_id,
        j.title,
        j.name,
        j.location,
        j.salary,
        j.date as job_posted_date
      FROM applies a
      JOIN jobpost j ON a.jobpost_id = j.jobpost_id
      WHERE a.user_id = ?
      ORDER BY a.applied_date DESC
    `, [userId]);

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user applications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a new application
app.post('/api/applications', async (req, res) => {
  try {
    const { user_id, jobpost_id } = req.body;
    
    if (!user_id || !jobpost_id) {
      res.status(400).json({
        success: false,
        message: 'User ID and job post ID are required'
      });
      return;
    }

    // Check if application already exists
    const existingApplication = await getRow(
      'SELECT user_id FROM applies WHERE user_id = ? AND jobpost_id = ?',
      [user_id, jobpost_id]
    );

    if (existingApplication) {
      res.status(400).json({
        success: false,
        message: 'Application already exists for this job'
      });
      return;
    }

    // Create new application
    await insertData(
      'INSERT INTO applies (user_id, jobpost_id, applied_date) VALUES (?, ?, NOW())',
      [user_id, jobpost_id]
    );

    res.json({ 
      success: true, 
      message: 'Application submitted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit application',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check or create chat between users
app.post('/api/chat/check-or-create', async (req, res) => {
  try {
    const { user_id, target_user_id } = req.body;
    
    if (!user_id || !target_user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID and target user ID are required'
      });
      return;
    }

    // Check if a group chat already exists between these users
    const existingChat = await getRow(`
      SELECT j1.groupchat_id
      FROM joins j1
      JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
      WHERE j1.user_id = ? AND j2.user_id = ?
      LIMIT 1
    `, [user_id, target_user_id]);

    if (existingChat) {
      res.json({ 
        success: true, 
        message: 'Chat already exists',
        data: { groupchat_id: existingChat.groupchat_id }
      });
      return;
    }

    // Create new pending group chat
    const groupChatId = await insertData(
      'INSERT INTO groupchat (groupchat_name, groupchat_status) VALUES (?, ?)',
      [`Chat between user ${user_id} and ${target_user_id}`, 0]
    );
    
    // Add both users to the group chat
    await insertData('INSERT INTO joins (user_id, groupchat_id) VALUES (?, ?)', [user_id, groupChatId]);
    await insertData('INSERT INTO joins (user_id, groupchat_id) VALUES (?, ?)', [target_user_id, groupChatId]);

    res.json({ 
      success: true, 
      message: 'Chat created successfully',
      data: { groupchat_id: groupChatId }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check or create chat',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Translation endpoint
app.post('/api/translate', async (req: any, res: any) => {
  try {
    const { text, fromLanguage, toLanguage } = req.body;
    
    if (!text || !fromLanguage || !toLanguage) {
      return res.status(400).json({
        success: false,
        message: 'Text, fromLanguage, and toLanguage are required'
      });
    }

    // Call the FastAPI translation server
    const response = await fetch('http://127.0.0.1:8001/translate', {
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

    if (!response.ok) {
      throw new Error(`FastAPI server responded with status: ${response.status}`);
    }

    const result = await response.json();
    
    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText: result.translatedText,
        fromLanguage,
        toLanguage
      }
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to translate message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user's preferred language
app.get('/api/user/:userId/preferred-language', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    
    const user = await getRow('SELECT preferred_language FROM users WHERE user_id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        preferred_language: user.preferred_language || 'english'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user preferred language',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update user's preferred language
app.put('/api/user/:userId/preferred-language', async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const { preferred_language } = req.body;
    
    if (!preferred_language) {
      return res.status(400).json({
        success: false,
        message: 'Preferred language is required'
      });
    }

    // Update the user's preferred language
    await updateData(
      'UPDATE users SET preferred_language = ? WHERE user_id = ?',
      [preferred_language, userId]
    );

    res.json({
      success: true,
      message: 'Preferred language updated successfully',
      data: {
        preferred_language
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user preferred language',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// IBM Granite AI endpoint for job description segmentation
app.post('/api/granite/segment', async (req: any, res: any) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Job description is required'
      });
    }

    // Call the Python FastAPI service (merged with translation service)
    const response = await fetch('http://127.0.0.1:8001/segment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python service error:', response.status, errorText);
      throw new Error(`Python service responded with status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.detail || 'Python service returned error');
    }

    res.json({
      success: true,
      data: result.data,
      message: result.message
    });
  } catch (error) {
    console.error('Job segmentation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to segment job description',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server with error handling
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
