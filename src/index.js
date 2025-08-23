const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();


const interviewRoutes = require('./routes/interviews');
const supabaseRoutes = require('./routes/supabaseRoutes');
const supabaseAuthRoutes = require('./routes/supabaseAuth');
const sessionsSupabaseRoutes = require('./routes/sessionsSupabase');
const fullLifeStoriesRoutes = require('./routes/fullLifeStories');
const webhookRoutes = require('./routes/webhooks'); // New webhook routes
// const adminRoutes = require('./routes/admin'); // Temporarily disabled due to missing controllers
const logsRoutes = require('./routes/logs');
const migrationRoutes = require('./routes/migration');
const { loggingMiddleware, errorLoggingMiddleware, requestLoggingMiddleware } = require('./middleware/loggingMiddleware');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  crossOriginOpenerPolicy: false, // Disable COOP for HTTP
  crossOriginEmbedderPolicy: false, // Disable COEP for HTTP
  originAgentCluster: false, // Disable Origin-Agent-Cluster header
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"], // Allow WebSocket connections
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
})); // Security headers with WebSocket support

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:5000', 
      'http://3.78.231.36', // Your EC2 public IP
      'http://3.78.231.36:3000',
      'http://3.78.231.36:5000',
      'https://legamunity-test.onrender.com', // Production domain
      'https://legamunity-test.onrender.com:443'
    ];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
})); // Enable CORS with configurable origins

app.use(morgan('dev')); // HTTP request logging
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies with larger limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Parse URL-encoded bodies

// Custom logging middleware
app.use(loggingMiddleware); // Add logging helpers to requests
// app.use(requestLoggingMiddleware); // Disabled - too much log noise

// Routes

app.use('/api/interviews', interviewRoutes);
app.use('/api/supabase', supabaseRoutes);
app.use('/api/supabase-auth', supabaseAuthRoutes);
app.use('/api/sessions-supabase', sessionsSupabaseRoutes);
app.use('/api/admin/full-life-stories', fullLifeStoriesRoutes);
app.use('/api/webhooks', webhookRoutes); // New webhook routes for AI callbacks
// app.use('/api/admin', adminRoutes); // Temporarily disabled due to missing controllers
app.use('/api/logs', logsRoutes);
app.use('/api/migration', migrationRoutes);

// API root route
app.get('/api', (req, res) => {
  res.send('Legamunity API is running');
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve React app for frontend routes
const frontendRoutes = [
  '/', 
  '/login', 
  '/register', 
  '/dashboard', 
  '/admin', 
  '/admin/dashboard',
  '/admin/sessions',
  '/admin/schedule',
  '/admin/start-interview',
  '/admin/live-interview',
  '/admin/draft-review',
  '/admin/final-approval',
  '/admin/users',
  '/admin/conflicts',
  '/admin/analytics',
  '/admin/full-life-stories',
  '/profile', 
  '/settings'
];

frontendRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
});

// Handle any other non-API routes by serving index.html
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    next();
  }
});

// Error handling middleware
app.use(errorLoggingMiddleware); // Log errors to database
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins, // Use the same CORS origins as Express
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
  transports: ['polling', 'websocket'] // Support both transports
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Join interview-specific room for targeted updates
  socket.on('join-interview', (interviewId) => {
    socket.join(`interview-${interviewId}`);
    console.log(`📡 Client ${socket.id} joined interview room: ${interviewId}`);
  });
  
  // Leave interview room
  socket.on('leave-interview', (interviewId) => {
    socket.leave(`interview-${interviewId}`);
    console.log(`📡 Client ${socket.id} left interview room: ${interviewId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Make io available globally for webhook broadcasts
global.io = io;

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
});

// Set server timeout to 5 minutes for AI processing
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000; // 5 minutes
server.headersTimeout = 310000; // Slightly higher than keepAliveTimeout

module.exports = app;
