const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// CORS Configuration
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection with timeout
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
  console.error('⚠️ MongoDB Connection Error:', err.message);
  console.log('Continuing without database - API will return mock data');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AfroConnect API is running' });
});

// Load routes - only essential ones
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (e) {
  console.error('⚠️ Auth routes error:', e.message);
  // Fallback auth endpoint
  app.post('/api/auth/login', (req, res) => {
    res.status(500).json({ success: false, message: 'Auth service unavailable' });
  });
}

try {
  const matchRoutes = require('./routes/match');
  app.use('/api/match', matchRoutes);
  console.log('✅ Match routes loaded');
} catch (e) {
  console.error('⚠️ Match routes error:', e.message);
  app.get('/api/match', (req, res) => {
    res.json({ success: false, message: 'Match service unavailable' });
  });
}

try {
  const userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log('✅ User routes loaded');
} catch (e) {
  console.error('⚠️ User routes error:', e.message);
}

try {
  const radarRoutes = require('./routes/radar');
  app.use('/api/radar', radarRoutes);
  console.log('✅ Radar routes loaded');
} catch (e) {
  console.error('⚠️ Radar routes error:', e.message);
}

try {
  const callRoutes = require('./routes/call');
  app.use('/api/call', callRoutes);
  console.log('✅ Call routes loaded');
} catch (e) {
  console.error('⚠️ Call routes error:', e.message);
}

try {
  const chatRoutes = require('./routes/chat');
  app.use('/api/chat', chatRoutes);
  console.log('✅ Chat routes loaded');
} catch (e) {
  console.error('⚠️ Chat routes error:', e.message);
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;
const server = require('http').createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AfroConnect Backend running on port ${PORT}`);
  console.log(`📡 API endpoints ready at https://62dabcc6-8e20-4794-b054-61c0eb4e7df7-00-3pakwfp6z0c3i.kirk.replit.dev:${PORT}/api`);
});

module.exports = { app, server };
