const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let runMigrations, getStripeSync, WebhookHandlers;
try {
  const stripeReplitSync = require('stripe-replit-sync');
  runMigrations = stripeReplitSync.runMigrations;
  getStripeSync = require('./stripe/stripeClient').getStripeSync;
  WebhookHandlers = require('./stripe/webhookHandlers').WebhookHandlers;
} catch (e) {
  console.log('⚠️ Stripe dependencies not available - payment features disabled');
}

// Debug: Log Cloudinary config status
console.log('Cloudinary config check:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
  api_key: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
});

const { sendExpoPushNotification } = require('./utils/pushNotifications');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchRoutes = require('./routes/match');
const friendRoutes = require('./routes/friends');
const chatRoutes = require('./routes/chat');
const callRoutes = require('./routes/call');
const uploadRoutes = require('./routes/upload');
const verificationRoutes = require('./routes/verification');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const legalRoutes = require('./routes/legal');
const accountRoutes = require('./routes/account');
const blockRoutes = require('./routes/block');
const adminRoutes = require('./routes/admin');
const storiesRoutes = require('./routes/stories');
const aiRoutes = require('./routes/ai');
const radarRoutes = require('./routes/radar');
const agoraRoutes = require('./routes/agora');
const icebreakerRoutes = require('./routes/icebreakers');
const activityRoutes = require('./routes/activity');
const promptsRoutes = require('./routes/prompts');
const quizRoutes = require('./routes/quiz');
const boostRoutes = require('./routes/boost');
const profileCompletionRoutes = require('./routes/profileCompletion');
const supportRoutes = require('./routes/support');

const successStoriesRoutes = require('./routes/successStories');
const subscriptionRoutes = require('./routes/subscription');
const commentsRoutes = require('./routes/comments');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = socketIO(server, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowEIO3: true
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e6
});

// CORS configuration
const corsOptions = {
  origin: true, // Reflect request origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Trust proxy for Replit environment
app.set('trust proxy', 1);

// Middleware - CORS first
app.use(cors(corsOptions));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[BACKEND] ${req.method} ${req.url}`);
  next();
});

// Stripe webhook route MUST be registered BEFORE express.json()
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// JSON middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - selective application
const { authLimiter } = require('./middleware/rateLimiter');
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);

// MongoDB Connection
const connectionString = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (connectionString && (connectionString.startsWith('mongodb://') || connectionString.startsWith('mongodb+srv://') || connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://'))) {
  // If it's a postgres URL but we are in a mongo app, we might need a mock or the user to provide Mongo
  // For now, let's just allow it to attempt connection if it's mongo, otherwise log warning
  if (connectionString.startsWith('mongodb')) {
    mongoose.connect(connectionString)
      .then(() => console.log('✅ MongoDB Connected'))
      .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
      });
  } else {
    console.log('⚠️ PostgreSQL URL detected but this app requires MongoDB. Please provide MONGODB_URI in secrets.');
  }
} else {
  console.log('⚠️ No MongoDB URI found. Falling back to local/mock mode.');
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AfroConnect API is running' });
});

// DEBUG: Log all registered routes after they are defined
const logRoutes = () => {
  if (app._router && app._router.stack) {
    app._router.stack.forEach(function(r){
      if (r.route && r.route.path){
        console.log(`[ROUTE] Registered: ${Object.keys(r.route.methods)} ${r.route.path}`);
      }
    });
  }
};

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/call', callRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/block', blockRoutes);
app.use('/api/admin', adminRoutes);
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/api/stories', storiesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/radar', radarRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/icebreakers', icebreakerRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/boost', boostRoutes);
app.use('/api/profile-completion', profileCompletionRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/success-stories', successStoriesRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/comments', commentsRoutes);

logRoutes();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AfroConnect API is running' });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AfroConnect Backend API',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users'
    }
  });
});

// Socket.io for real-time chat
const onlineUsers = new Map();
const User = require('./models/User');

// Make io available to routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

const updateUserOnlineStatus = async (userId, status) => {
  try {
    const updateData = { onlineStatus: status };
    if (status === 'offline') {
      updateData.lastActive = new Date();
    }
    await User.findByIdAndUpdate(userId, updateData);
  } catch (error) {
    console.error('Failed to update user online status:', error);
  }
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Extract userId from token in auth or query
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    try {
      const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
      // Handle both 'id' and '_id' in token payload
      const userId = decoded.id || decoded._id;
      if (userId) {
        socket.userId = userId.toString();
        onlineUsers.set(socket.userId, socket.id);
        socket.join(socket.userId);
        console.log('User authenticated from token:', socket.userId);
        updateUserOnlineStatus(socket.userId, 'online');
        io.emit('user:status', { userId: socket.userId, isOnline: true });
      }
    } catch (err) {
      console.log('Socket token verification failed:', err.message);
    }
  }

  // User goes online - also allows explicit user registration
  socket.on('user:online', (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      socket.join(userId);
      io.emit('user:status', { userId, isOnline: true });
      updateUserOnlineStatus(userId, 'online');
    }
  });

  // Join chat room
  socket.on('chat:join', (chatId) => {
    if (chatId) {
      socket.join(chatId);
      console.log(`User ${socket.userId || socket.id} joined chat: ${chatId}`);
    }
  });

  // Send message - broadcast immediately
  socket.on('chat:message', (data) => {
    if (data.chatId) {
      const messageData = {
        ...data,
        _id: data._id || data.id || Date.now().toString(),
        createdAt: data.createdAt || new Date().toISOString(),
        status: 'delivered'
      };
      io.to(data.chatId).emit('chat:new-message', messageData);
      
      // Also send to receiver's personal room for notification
      if (data.receiverId) {
        io.to(data.receiverId).emit('chat:new-message', messageData);
      }
    }
  });

  // Typing indicator
  socket.on('chat:typing', (data) => {
    if (data.chatId) {
      socket.to(data.chatId).emit('chat:user-typing', {
        userId: data.userId,
        isTyping: data.isTyping !== false,
        chatId: data.chatId
      });
    }
  });

  // Mark message as read
  socket.on('chat:mark-read', (data) => {
    if (data.chatId && data.userId) {
      io.to(data.chatId).emit('chat:message-read', {
        chatId: data.chatId,
        userId: data.userId,
        readAt: new Date().toISOString()
      });
    }
  });

  // Message delivered acknowledgment
  socket.on('chat:delivered', (data) => {
    if (data.chatId && data.messageId) {
      io.to(data.chatId).emit('chat:message-status', {
        messageId: data.messageId,
        status: 'delivered'
      });
    }
  });

  // Voice recording indicator
  socket.on('chat:recording-voice', (data) => {
    if (data.chatId) {
      socket.to(data.chatId).emit('chat:recording-voice', {
        userId: data.userId,
        isRecording: data.isRecording
      });
    }
  });

  // Helper function to save call message to chat
  async function saveCallMessage(callerId, receiverId, callType, callStatus, duration = null) {
    try {
      const Match = require('./models/Match');
      const Message = require('./models/Message');
      const mongoose = require('mongoose');
      
      // Validate IDs before conversion
      if (!callerId || !receiverId) {
        console.log('Missing callerId or receiverId for call message');
        return null;
      }
      
      // Check if IDs are valid MongoDB ObjectIds (24 hex characters)
      const isValidObjectId = (id) => {
        if (!id) return false;
        const idStr = id.toString();
        return /^[a-fA-F0-9]{24}$/.test(idStr);
      };
      
      if (!isValidObjectId(callerId) || !isValidObjectId(receiverId)) {
        console.log('Invalid ObjectId format for call message:', callerId, receiverId);
        return null;
      }
      
      // Convert string IDs to ObjectId
      const callerObjectId = new mongoose.Types.ObjectId(callerId.toString());
      const receiverObjectId = new mongoose.Types.ObjectId(receiverId.toString());
      
      // Find the match between these users (Match model uses 'users' array with status 'active')
      const match = await Match.findOne({
        users: { $all: [callerObjectId, receiverObjectId] },
        status: 'active'
      });
      
      if (!match) {
        console.log('No match found for call message between', callerId, 'and', receiverId);
        return null;
      }
      
      const callDuration = duration || 0;
      const message = await Message.create({
        matchId: match._id,
        sender: callerObjectId,
        receiver: receiverObjectId,
        type: 'call',
        callType: callType,
        callStatus: callStatus,
        callDuration: callDuration,
        content: callStatus === 'completed' && callDuration > 0
          ? `${callType === 'video' ? 'Video' : 'Voice'} call - ${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, '0')}`
          : callStatus === 'missed' 
            ? `Missed ${callType === 'video' ? 'video' : 'voice'} call`
            : `${callType === 'video' ? 'Video' : 'Voice'} call declined`
      });
      
      console.log('Call message saved:', callStatus, callType, 'between', callerId, 'and', receiverId);
      
      // Emit to both users
      const messageData = {
        _id: message._id,
        matchId: match._id,
        sender: callerId.toString(),
        receiver: receiverId.toString(),
        type: 'call',
        callType,
        callStatus,
        callDuration: callDuration,
        content: message.content,
        createdAt: message.createdAt
      };
      
      io.to(callerId.toString()).emit('chat:new-message', messageData);
      io.to(receiverId.toString()).emit('chat:new-message', messageData);
      
      return message;
    } catch (err) {
      console.error('Error saving call message:', err);
      return null;
    }
  }

  // Call signaling - incoming call to target user
  socket.on('call:initiate', async (data) => {
    const { targetUserId, callData, callerInfo } = data;
    if (targetUserId) {
      const callerId = socket.userId || callerInfo?.id;
      
      socket.pendingCall = {
        targetUserId,
        callerId,
        callType: callData.callType,
        startTime: Date.now()
      };

      io.to(targetUserId).emit('call:incoming', {
        callData,
        callerInfo: {
          ...callerInfo,
          id: callerId
        },
        callerId: callerId
      });
      console.log(`Call initiated from ${callerId} to ${targetUserId}`);
      
      const isTargetOnline = onlineUsers.has(targetUserId);
      if (!isTargetOnline) {
        try {
          const targetUser = await User.findById(targetUserId).select('pushToken pushNotificationsEnabled');
          if (targetUser?.pushToken && targetUser.pushNotificationsEnabled) {
            const callerName = callerInfo?.name || 'Someone';
            const callType = callData?.callType || 'voice';
            await sendExpoPushNotification(targetUser.pushToken, {
              title: `Incoming ${callType} call`,
              body: `${callerName} is calling you...`,
              data: { type: 'call', callerId, callType, channelName: callData.channelName },
              priority: 'high',
              sound: 'default',
              channelId: 'calls'
            });
          }
        } catch (err) {
          console.error('Failed to send call push notification:', err);
        }
      }
    }
  });

  // Call accepted
  socket.on('call:accept', (data) => {
    const { callerId, callData } = data;
    if (callerId) {
      // Store call start time for duration calculation
      socket.activeCall = {
        callerId,
        startTime: Date.now(),
        callType: callData?.callType || 'audio'
      };
      
      io.to(callerId).emit('call:accepted', {
        acceptedBy: socket.userId,
        callData
      });
      console.log(`Call accepted by ${socket.userId}`);
    }
  });

  // Call declined
  socket.on('call:decline', async (data) => {
    const { callerId, callType } = data;
    if (callerId) {
      // Save declined call message
      await saveCallMessage(callerId, socket.userId, callType || 'audio', 'declined');
      
      io.to(callerId).emit('call:declined', {
        declinedBy: socket.userId
      });
      console.log(`Call declined by ${socket.userId}`);
    }
  });

  // Call ended
  socket.on('call:end', async (data) => {
    const { targetUserId, callType, duration, wasAnswered } = data;
    if (targetUserId) {
      const callerId = socket.userId;
      
      if (wasAnswered && duration) {
        // Completed call with duration
        await saveCallMessage(callerId, targetUserId, callType || 'audio', 'completed', duration);
      } else if (!wasAnswered) {
        // Missed call (caller hung up before answer)
        await saveCallMessage(callerId, targetUserId, callType || 'audio', 'missed');
      }
      
      io.to(targetUserId).emit('call:ended', {
        endedBy: socket.userId
      });
    }
  });
  
  // Call missed (timeout or no answer)
  socket.on('call:missed', async (data) => {
    const { targetUserId, callType } = data;
    if (targetUserId && socket.userId) {
      await saveCallMessage(socket.userId, targetUserId, callType || 'audio', 'missed');
      console.log(`Missed call from ${socket.userId} to ${targetUserId}`);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('user:status', { userId: socket.userId, isOnline: false });
      updateUserOnlineStatus(socket.userId, 'offline');
    } else {
      for (let [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          io.emit('user:status', { userId, isOnline: false });
          updateUserOnlineStatus(userId, 'offline');
          break;
        }
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize Stripe schema and webhooks
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('⚠️ DATABASE_URL not set - Stripe integration disabled');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    // await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('✅ Stripe schema ready (Skipped migrations)');
    /*
    const stripeSync = await getStripeSync();
    */
    console.log('Setting up managed webhook...');
    const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    const protocol = (process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS) ? 'https' : 'http';
    const webhookBaseUrl = `${protocol}://${domain}`;
    
    /*
    try {
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`,
        {
          enabled_events: ['*'],
          description: 'AfroConnect webhook for subscription sync',
        }
      );
      if (result && result.webhook) {
        console.log(`✅ Webhook configured: ${result.webhook.url} (UUID: ${result.uuid})`);
      } else {
        console.log('✅ Webhook setup complete');
      }
    } catch (webhookError) {
      console.log('⚠️ Webhook setup skipped:', webhookError.message);
    }

    console.log('Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => console.log('✅ Stripe data synced'))
      .catch((err) => console.error('Error syncing Stripe data:', err));
    */
  } catch (error) {
    console.error('Failed to initialize Stripe:', error.message);
  }
}

const PORT = process.env.PORT || 3001;
const startServer = () => {
  const serverInstance = server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 AfroConnect Backend running on port ${PORT}`);
    console.log(`📡 Backend API ready`);
    
    try {
      await initStripe();
    } catch (err) {
      console.error('Stripe init error:', err.message);
    }
  });

  serverInstance.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log('Address in use, retrying...');
      setTimeout(() => {
        serverInstance.close();
        startServer();
      }, 1000);
    }
  });
};

startServer();

// Keep-alive loop
setInterval(() => {}, 60000);

module.exports = { app, io };