const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


const { sendExpoPushNotification } = require('./utils/pushNotifications');
const Message = require('./models/Message');

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

const compression = require('compression');
const helmet = require('helmet');

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

// Optional Redis setup for socket scaling / shared state
let redisClient;
let redisPubClient;
let redisSubClient;

const setUserBusy = async (userId, isBusy) => {
  if (!redisClient || !userId) return;
  try {
    const key = `busy:${userId}`;
    if (isBusy) {
      // Keep busy state for 5 minutes by default to avoid stale state
      await redisClient.set(key, '1', { EX: 60 * 5 });
    } else {
      await redisClient.del(key);
    }
  } catch (err) {
    console.error('Redis busy flag error:', err);
  }
};

const isUserBusy = async (userId) => {
  if (!redisClient || !userId) return false;
  try {
    const value = await redisClient.get(`busy:${userId}`);
    return !!value;
  } catch (err) {
    console.error('Redis busy flag read error:', err);
    return false;
  }
};

const setupRedisAdapter = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return;
  }

  try {
    const { createClient } = require('redis');
    const { createAdapter } = require('@socket.io/redis-adapter');

    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.error('Redis client error:', err));
    await redisClient.connect();

    redisPubClient = redisClient.duplicate();
    redisSubClient = redisClient.duplicate();
    await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);

    io.adapter(createAdapter(redisPubClient, redisSubClient));
    console.log('✅ Socket.IO Redis adapter enabled');
  } catch (err) {
    console.error('❌ Failed to initialize Redis adapter:', err);
  }
};

setupRedisAdapter();

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

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// Gzip compression for all responses
app.use(compression());

// Middleware - CORS first
app.use(cors(corsOptions));

// Lightweight request logging (only in development to avoid performance hit)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[BACKEND] ${req.method} ${req.url}`);
    next();
  });
}

app.use('/admin-web', express.static(path.join(__dirname, '..', 'admin-dashboard'), { index: 'index.html' }));
app.get('/admin-web', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin-dashboard', 'index.html'));
});

// JSON middleware for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const { authLimiter, apiLimiter, uploadLimiter, messageLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);

// MongoDB Connection
const connectionString = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (connectionString && (connectionString.startsWith('mongodb://') || connectionString.startsWith('mongodb+srv://') || connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://'))) {
  // If it's a postgres URL but we are in a mongo app, we might need a mock or the user to provide Mongo
  // For now, let's just allow it to attempt connection if it's mongo, otherwise log warning
  if (connectionString.startsWith('mongodb')) {
    mongoose.connect(connectionString, {
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
      .then(async () => {
        console.log('✅ MongoDB Connected');
        try {
          const User = require('./models/User');
          const result = await User.updateMany(
            { emailVerified: true, expireAt: { $ne: null } },
            { $unset: { expireAt: 1 } }
          );
          if (result.modifiedCount > 0) {
            console.log(`🔧 Cleared expireAt for ${result.modifiedCount} verified users`);
          }
          try {
            const collection = mongoose.connection.collection('users');
            const indexes = await collection.indexes();
            const ttlIndex = indexes.find(idx => idx.key && idx.key.expireAt === 1 && idx.expireAfterSeconds !== undefined);
            if (ttlIndex && ttlIndex.expireAfterSeconds !== 86400) {
              await collection.dropIndex(ttlIndex.name);
              await collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 86400 });
              console.log('🔧 Updated TTL index to 24 hours');
            }
          } catch (idxErr) {
            console.log('TTL index check skipped:', idxErr.message);
          }
        } catch (migrationErr) {
          console.log('Migration check skipped:', migrationErr.message);
        }
      })
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

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: Date.now(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chat', messageLimiter, chatRoutes);
app.use('/api/call', callRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
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

  // Helper: mark messages as read and broadcast status updates
  const handleMarkRead = async (data) => {
    if (!data || !data.chatId || !data.userId) return;

    try {
      const filter = {
        matchId: data.chatId,
        receiver: data.userId,
        seen: false
      };
      if (data.messageId) {
        filter._id = data.messageId;
      }

      await Message.updateMany(filter, {
        $set: { seen: true, seenAt: new Date(), status: 'seen' }
      });
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }

    io.to(data.chatId).emit('chat:message-read', {
      chatId: data.chatId,
      userId: data.userId,
      messageId: data.messageId,
      readAt: new Date().toISOString()
    });
  };

  socket.on('chat:mark-read', handleMarkRead);
  socket.on('chat:read', handleMarkRead);
  socket.on('message:read', handleMarkRead);

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

  // Screenshot protection toggle
  socket.on('chat:screenshot-protection', async (data) => {
    if (data.chatId) {
      try {
        const Match = require('./models/Match');
        await Match.findByIdAndUpdate(data.chatId, { screenshotProtection: data.enabled });
      } catch (e) {
        console.error('Screenshot protection update error:', e);
      }
      io.to(data.chatId).emit('chat:screenshot-protection-updated', {
        chatId: data.chatId,
        enabled: data.enabled,
        updatedBy: data.userId
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

      // Check if target user is busy (already in a call)
      const targetBusy = await isUserBusy(targetUserId);
      if (targetBusy) {
        io.to(callerId).emit('call:busy', { targetUserId });
        console.log(`User ${targetUserId} is busy, notifying ${callerId}`);
        return;
      }

      // Mark caller as busy for the duration of the call attempt
      await setUserBusy(callerId, true);

      socket.pendingCall = {
        targetUserId,
        callerId,
        callType: callData.callType,
        startTime: Date.now()
      };

      setTimeout(() => {
        if (socket.pendingCall && socket.pendingCall.targetUserId === targetUserId) {
          socket.pendingCall = null;
        }
      }, 35000);

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
          const targetUser = await User.findById(targetUserId).select('pushToken pushNotificationsEnabled muteSettings');
          const callType = callData?.callType || 'voice';
          const isMutedByCaller = targetUser?.muteSettings?.mutedUsers?.some(
            (m) =>
              m.userId.toString() === callerId &&
              (m.muteAll || (callType === 'voice' ? m.muteVoiceCalls : m.muteVideoCalls))
          );
          if (targetUser?.pushToken && targetUser.pushNotificationsEnabled && !isMutedByCaller) {
            const callerName = callerInfo?.name || 'Someone';
            await sendExpoPushNotification(targetUser.pushToken, {
              title: `Incoming ${callType} call`,
              body: `${callerName} is calling you...`,
              data: { type: 'call', callerId, callType, callData, callerName, callerPhoto: callerInfo?.photo || '' },
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
  socket.on('call:accept', async (data) => {
    const { callerId, callData } = data;
    if (callerId) {
      socket.activeCall = {
        callerId,
        startTime: Date.now(),
        callType: callData?.callType || 'audio'
      };

      // Mark both the caller and callee as busy
      await setUserBusy(socket.userId, true);
      await setUserBusy(callerId, true);

      // Also mark caller socket as in active call
      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        const callerSocket = io.sockets.sockets.get(callerSocketId);
        if (callerSocket) {
          callerSocket.activeCall = {
            callerId: socket.userId,
            startTime: Date.now(),
            callType: callData?.callType || 'audio'
          };
          callerSocket.pendingCall = null;
        }
      }
      
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
      await saveCallMessage(callerId, socket.userId, callType || 'audio', 'declined');

      // Clear pending call on both sides
      socket.pendingCall = null;
      await setUserBusy(socket.userId, false);
      await setUserBusy(callerId, false);

      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        const callerSocket = io.sockets.sockets.get(callerSocketId);
        if (callerSocket) callerSocket.pendingCall = null;
      }
      
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
        await saveCallMessage(callerId, targetUserId, callType || 'audio', 'completed', duration);
      } else if (!wasAnswered) {
        await saveCallMessage(callerId, targetUserId, callType || 'audio', 'missed');
      }

      // Clear busy and active call state for both parties
      socket.activeCall = null;
      socket.pendingCall = null;
      await setUserBusy(socket.userId, false);
      await setUserBusy(targetUserId, false);

      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.activeCall = null;
          targetSocket.pendingCall = null;
        }
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
      socket.pendingCall = null;
      socket.activeCall = null;
      await setUserBusy(socket.userId, false);
      await setUserBusy(targetUserId, false);

      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.pendingCall = null;
          targetSocket.activeCall = null;
        }
      }
      await saveCallMessage(socket.userId, targetUserId, callType || 'audio', 'missed');
      console.log(`Missed call from ${socket.userId} to ${targetUserId}`);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    // Clear busy flag for this user
    if (socket.userId) {
      setUserBusy(socket.userId, false).catch(() => {});
    }

    if (socket.pendingCall) {
      const targetId = socket.pendingCall.targetUserId;
      if (targetId) {
        const targetSocketId = onlineUsers.get(targetId);
        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.pendingCall = null;
            targetSocket.activeCall = null;
          }
        }
      }
    }
    if (socket.activeCall) {
      const otherUserId = socket.activeCall.callerId;
      if (otherUserId) {
        setUserBusy(otherUserId, false).catch(() => {});
        io.to(otherUserId).emit('call:ended', { endedBy: socket.userId });
        const otherSocketId = onlineUsers.get(otherUserId);
        if (otherSocketId) {
          const otherSocket = io.sockets.sockets.get(otherSocketId);
          if (otherSocket) {
            otherSocket.activeCall = null;
            otherSocket.pendingCall = null;
          }
        }
      }
    }
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

const PORT = process.env.PORT || 3001;
const startServer = () => {
  const serverInstance = server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 AfroConnect Backend running on port ${PORT}`);
    console.log(`📡 Backend API ready`);
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