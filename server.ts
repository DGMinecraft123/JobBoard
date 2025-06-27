import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { testConnection, executeQuery, getRow, insertData, updateData, deleteData } from './src/lib/database';

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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a group chat room
  socket.on('join-group-chat', async (data: { userId: number, posterId: number }) => {
    try {
      const { userId, posterId } = data;
      
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
      }
    } catch (error) {
      console.error('Error joining group chat:', error);
    }
  });

  // Handle new message
  socket.on('send-message', async (data: { 
    messageContent: string, 
    userId: number, 
    posterId: number,
    groupChatId?: number 
  }) => {
    try {
      const { messageContent, userId, posterId, groupChatId } = data;
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
          socket.emit('error', { message: 'No group chat found between these users' });
          return;
        }
        targetGroupChatId = groupChat.groupchat_id;
      }

      // Insert the message into database
      const messageId = await insertData(
        'INSERT INTO messages (message_content, message_time) VALUES (?, NOW())',
        [messageContent]
      );

      // Create the relationship in contains table
      await insertData(
        'INSERT INTO contains (user_id, groupchat_id, message_id) VALUES (?, ?, ?)',
        [userId, targetGroupChatId, messageId]
      );

      // Get user info for the message
      const user = await getRow(
        'SELECT user_id, first_name, last_name, profile_picture_url FROM users WHERE user_id = ?',
        [userId]
      );

      // Get the message with timestamp
      const message = await getRow(
        'SELECT message_id, message_content, message_time FROM messages WHERE message_id = ?',
        [messageId]
      );

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

      console.log(`Message sent in room ${roomName}:`, messageData);
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

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Middleware - similar to express.json() in JavaScript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      res.json({ 
        success: true, 
        message: 'Database connection successful',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Database connection failed' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all job posts
app.get('/api/jobposts', async (req, res) => {
  try {
    const jobPosts = await executeQuery(`
      SELECT 
        j.jobpost_id,
        j.title,
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
      ORDER BY j.date DESC
    `);
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

// Create new job post
app.post('/api/jobposts', async (req, res) => {
  try {
    const { title, location, description, pictures_url, qualifications, salary, user_id } = req.body;
    
    // Insert the job post
    const insertId = await insertData(
      'INSERT INTO jobpost (title, location, description, pictures_url, qualifications, salary, date) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [title, location, description, pictures_url, qualifications, salary]
    );
    
    // If user_id is provided, create the relationship in posts table
    if (user_id) {
      await insertData(
        'INSERT INTO posts (user_id, jobpost_id) VALUES (?, ?)',
        [user_id, insertId]
      );
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Job post created successfully',
      data: { jobpost_id: insertId, title, location, description, pictures_url, qualifications, salary, user_id }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create job post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update job post
app.put('/api/jobposts/:id', async (req, res) => {
  try {
    const { title, location, description, pictures_url, qualifications, salary } = req.body;
    const affectedRows = await updateData(
      'UPDATE jobpost SET title = ?, location = ?, description = ?, pictures_url = ?, qualifications = ?, salary = ? WHERE jobpost_id = ?',
      [title, location, description, pictures_url, qualifications, salary, req.params.id]
    );
    if (affectedRows > 0) {
      res.json({ success: true, message: 'Job post updated successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Job post not found' });
    }
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
    const affectedRows = await deleteData('DELETE FROM jobpost WHERE jobpost_id = ?', [req.params.id]);
    if (affectedRows > 0) {
      res.json({ success: true, message: 'Job post deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Job post not found' });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete job post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// User registration
app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { first_name, last_name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await getRow('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const userId = await insertData(
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      [first_name, last_name, email, hashedPassword]
    );

    // Update with default profile picture URL
    await updateData(
      'UPDATE users SET profile_picture_url = ? WHERE user_id = ?',
      [`profile_picture/${userId}`, userId]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId, email, first_name, last_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          user_id: userId,
          first_name,
          last_name,
          email
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
app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await getRow('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        email: user.email, 
        first_name: user.first_name, 
        last_name: user.last_name 
      },
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
        j.date as job_posted_date
      FROM users u
      JOIN posts p ON u.user_id = p.user_id
      JOIN jobpost j ON p.jobpost_id = j.jobpost_id
      JOIN joins jo ON u.user_id = jo.user_id
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

// Get group chat ID between two users
app.get('/api/job-posters/:id/group-chat', async (req, res) => {
  try {
    const { user_id } = req.query; // Current user's ID
    const posterId = parseInt(req.params.id); // Job poster's ID
    
    if (!user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // Find the group chat that both users are part of
    const groupChat = await getRow(`
      SELECT j1.groupchat_id
      FROM joins j1
      JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
      WHERE j1.user_id = ? AND j2.user_id = ?
      LIMIT 1
    `, [user_id, posterId]);

    if (!groupChat) {
      res.status(404).json({
        success: false,
        message: 'No group chat found between these users'
      });
      return;
    }

    res.json({ 
      success: true, 
      data: { groupchat_id: groupChat.groupchat_id }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get group chat',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get messages for a specific job poster
app.get('/api/job-posters/:id/messages', async (req, res) => {
  try {
    const { user_id } = req.query; // Current user's ID
    const posterId = parseInt(req.params.id); // Job poster's ID
    
    if (!user_id) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    // First, find the group chat that both users are part of
    const groupChat = await getRow(`
      SELECT j1.groupchat_id
      FROM joins j1
      JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
      WHERE j1.user_id = ? AND j2.user_id = ?
      LIMIT 1
    `, [user_id, posterId]);

    if (!groupChat) {
      res.status(404).json({
        success: false,
        message: 'No group chat found between these users'
      });
      return;
    }

    // Now fetch messages from that group chat
    const messages = await executeQuery(`
      SELECT 
        m.message_id,
        m.message_content,
        m.message_time,
        u.user_id,
        u.first_name,
        u.last_name,
        u.profile_picture_url
      FROM messages m
      JOIN contains c ON m.message_id = c.message_id
      JOIN users u ON c.user_id = u.user_id
      WHERE c.groupchat_id = ?
      ORDER BY m.message_time ASC
    `, [groupChat.groupchat_id]);
    
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send a message to a job poster
app.post('/api/job-posters/:id/messages', async (req, res) => {
  try {
    const { message_content, user_id } = req.body;
    const posterId = parseInt(req.params.id); // Job poster's ID
    
    // First, find the group chat that both users are part of
    const groupChat = await getRow(`
      SELECT j1.groupchat_id
      FROM joins j1
      JOIN joins j2 ON j1.groupchat_id = j2.groupchat_id
      WHERE j1.user_id = ? AND j2.user_id = ?
      LIMIT 1
    `, [user_id, posterId]);

    if (!groupChat) {
      res.status(404).json({
        success: false,
        message: 'No group chat found between these users'
      });
      return;
    }
    
    // Insert the message
    const messageId = await insertData(
      'INSERT INTO messages (message_content, message_time) VALUES (?, NOW())',
      [message_content]
    );
    
    // Create the relationship in contains table
    await insertData(
      'INSERT INTO contains (user_id, groupchat_id, message_id) VALUES (?, ?, ?)',
      [user_id, groupChat.groupchat_id, messageId]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Message sent successfully',
      data: { message_id: messageId, message_content, groupchat_id: groupChat.groupchat_id, user_id }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database test endpoint: http://localhost:${PORT}/api/test-db`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Socket.IO server ready`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

export default app;