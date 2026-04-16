const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: false });


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
const muteRoutes = require('./routes/mute');

const compression = require('compression');
const helmet = require('helmet');
const hpp = require('hpp');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Increase timeouts for large file uploads (voice notes, photos, videos)
server.headersTimeout = 5 * 60 * 1000;  // 5 minutes
server.requestTimeout = 5 * 60 * 1000;  // 5 minutes
server.timeout = 5 * 60 * 1000;         // 5 minutes
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

const isOriginAllowed = (origin) => {
  if (!origin) return true; // allow non-browser requests (mobile apps, Postman)
  if (ALLOWED_ORIGINS.length === 0) return true; // dev mode: no restriction
  return ALLOWED_ORIGINS.some(allowed =>
    origin === allowed ||
    origin.endsWith('.replit.app') ||
    origin.endsWith('.replit.dev') ||
    origin.endsWith('.vercel.app')
  );
};

const io = socketIO(server, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO CORS: origin not allowed'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowEIO3: true
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e6
});

app.set('io', io);

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

// CORS configuration — only allow known origins
const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin not allowed'));
    }
  },
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

// Lightweight request logging (non-production: log everything; production: log notification routes always)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[BACKEND] ${req.method} ${req.url}`);
    next();
  });
} else {
  // In production, always log push-notification-related routes so we can
  // diagnose delivery issues without enabling full verbose logging.
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/notifications') || req.url.startsWith('/api/engagement')) {
      console.log(`[BACKEND] ${req.method} ${req.url}`);
    }
    next();
  });
}

// JSON middleware for all routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize request data against NoSQL injection (custom deep sanitizer)
// Recursively removes keys starting with $ or containing . from req.body and req.params
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach(key => {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  });
};
app.use((req, res, next) => {
  sanitizeObject(req.body);
  sanitizeObject(req.params);
  next();
});

// XSS protection — strip dangerous HTML tags from string values in req.body only
// (avoids the req.query getter-only issue that breaks xss-clean on this Express version)
const xssSanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key]
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (typeof obj[key] === 'object') {
      xssSanitize(obj[key]);
    }
  });
};
app.use((req, res, next) => {
  if (req.body) xssSanitize(req.body);
  next();
});

// Prevent HTTP parameter pollution
app.use(hpp());

// Rate limiting
const { authLimiter, otpLimiter, forgotPasswordLimiter, adminLimiter, apiLimiter, uploadLimiter, messageLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/verify-otp', otpLimiter);
app.use('/api/auth/resend-otp', otpLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/auth/reset-password', forgotPasswordLimiter);
app.use('/api/admin', adminLimiter);

// Admin dashboard — require a valid admin JWT before serving the HTML
const { protect } = require('./middleware/auth');
const adminWebAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).sendFile(path.join(__dirname, '..', 'admin-dashboard', 'login.html'),
      (err) => {
        if (err) res.status(401).json({ success: false, message: 'Admin authentication required' });
      }
    );
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('./models/User');
    const user = await User.findById(decoded.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

app.use('/admin-web', adminWebAuth, express.static(path.join(__dirname, '..', 'admin-dashboard'), { index: 'index.html' }));
app.get('/admin-web', adminWebAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin-dashboard', 'index.html'));
});

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
const auditLogRoutes = require('./routes/auditLog');
app.use('/api/admin/audit-log', auditLogRoutes);
const scheduledBroadcastRoutes = require('./routes/scheduledBroadcasts');
app.use('/api/admin/scheduled-broadcasts', scheduledBroadcastRoutes);
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
const engagementRoutes = require('./routes/engagement');
app.use('/api/engagement', engagementRoutes);
app.use('/api/comments', commentsRoutes);
const streakRoutes = require('./routes/streak');
app.use('/api/streak', streakRoutes);
const spotifyRoutes = require('./routes/spotify');
app.use('/api/spotify', spotifyRoutes);
app.use('/api/mute', muteRoutes);
/* Alias: some redirect URIs may be registered without the /api prefix */
app.get('/auth/spotify/callback', (req, res) => {
  const qs = Object.keys(req.query).map(k => `${k}=${encodeURIComponent(req.query[k])}`).join('&');
  res.redirect(`/api/spotify/callback${qs ? '?' + qs : ''}`);
});

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
  // Extract and verify userId ONLY from the JWT — never trust client-provided user IDs
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    try {
      const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded._id;
      if (userId) {
        socket.userId = userId.toString();
        onlineUsers.set(socket.userId, socket.id);
        socket.join(socket.userId);
        updateUserOnlineStatus(socket.userId, 'online');
        io.emit('user:status', { userId: socket.userId, isOnline: true });
      }
    } catch (err) {
      // Token invalid — socket connects but is not authenticated
    }
  }

  // user:online — only update status for the verified user, ignore any client-provided ID
  socket.on('user:online', () => {
    if (socket.userId) {
      onlineUsers.set(socket.userId, socket.id);
      io.emit('user:status', { userId: socket.userId, isOnline: true });
      updateUserOnlineStatus(socket.userId, 'online');
    }
  });

  // Join chat room — verify the authenticated user is actually a participant before joining
  socket.on('chat:join', async (chatId) => {
    if (!chatId || !socket.userId) return;
    try {
      const Match = require('./models/Match');
      const match = await Match.findById(chatId).select('users').lean();
      if (!match) return;
      const isParticipant = match.users.some(uid => uid.toString() === socket.userId);
      if (isParticipant) {
        socket.join(chatId);
      }
    } catch (err) {
      // Silently reject invalid join attempts
    }
  });

  // Send message — only relay if sender matches the authenticated socket user
  socket.on('chat:message', (data) => {
    if (!data.chatId || !socket.userId) return;
    // Enforce that the sender field matches the authenticated user
    if (data.senderId && data.senderId !== socket.userId) return;
    const messageData = {
      ...data,
      senderId: socket.userId, // always use server-verified identity
      _id: data._id || data.id || Date.now().toString(),
      createdAt: data.createdAt || new Date().toISOString(),
      status: 'delivered'
    };
    io.to(data.chatId).emit('chat:new-message', messageData);
    if (data.receiverId) {
      io.to(data.receiverId).emit('chat:new-message', messageData);
    }
  });

  // Typing indicator — use server-verified identity, require authentication
  socket.on('chat:typing', (data) => {
    if (data.chatId && socket.userId) {
      socket.to(data.chatId).emit('chat:user-typing', {
        userId: socket.userId,
        isTyping: data.isTyping !== false,
        chatId: data.chatId
      });
    }
  });

  // Helper: mark messages as read — always use the server-verified socket.userId
  const handleMarkRead = async (data) => {
    if (!data || !data.chatId || !socket.userId) return;

    try {
      const filter = {
        matchId: data.chatId,
        receiver: socket.userId,
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
      userId: socket.userId,
      messageId: data.messageId,
      readAt: new Date().toISOString()
    });
  };

  socket.on('chat:mark-read', handleMarkRead);
  socket.on('chat:read', handleMarkRead);
  socket.on('message:read', handleMarkRead);

  // Message delivered acknowledgment — require authentication
  socket.on('chat:delivered', (data) => {
    if (data.chatId && data.messageId && socket.userId) {
      io.to(data.chatId).emit('chat:message-status', {
        messageId: data.messageId,
        status: 'delivered'
      });
    }
  });

  // Voice recording indicator — use server-verified identity
  socket.on('chat:recording-voice', (data) => {
    if (data.chatId && socket.userId) {
      socket.to(data.chatId).emit('chat:recording-voice', {
        userId: socket.userId,
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
          const callType = callData?.callType || 'voice';
          const notifType = callType === 'video' ? 'video_call' : 'voice_call';
          const targetUser = await User.findById(targetUserId).select(
            'pushToken pushNotificationsEnabled muteSettings notificationPreferences'
          );
          const callerName = callerInfo?.name || 'Someone';
          const { sendSmartNotification } = require('./utils/pushNotifications');
          await sendSmartNotification(
            targetUser,
            {
              title: `Incoming ${callType} call`,
              body: `${callerName} is calling you...`,
              data: { type: 'call', callerId, callType, callData, callerName, callerPhoto: callerInfo?.photo || '' },
            },
            notifType,
            callerId,
          );
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

  // User is busy — forward busy signal to the caller
  socket.on('call:busy', async (data) => {
    const { callerId, callType } = data;
    if (callerId) {
      // Clear pending call state without saving a history entry
      socket.pendingCall = null;
      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        const callerSocket = io.sockets.sockets.get(callerSocketId);
        if (callerSocket) callerSocket.pendingCall = null;
      }
      io.to(callerId).emit('call:busy', { targetUserId: socket.userId });
      console.log(`User ${socket.userId} is busy — notified caller ${callerId}`);
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
    const { startScheduledJobs } = require('./utils/scheduledJobs');
    startScheduledJobs();
    const { startBroadcastScheduler } = require('./jobs/broadcastScheduler');
    startBroadcastScheduler();
    // Pre-warm face AI models so the first validate-pose request isn't slow
    const { loadModels } = require('./utils/poseValidator');
    loadModels().then(() => console.log('🤖 Face AI models ready')).catch(() => {});
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