const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();


const interviewRoutes = require('./routes/interviews');
const testDraftsRoutes = require('./routes/test-drafts');
const supabaseRoutes = require('./routes/supabaseRoutes');
const supabaseAuthRoutes = require('./routes/supabaseAuth');
const sessionsSupabaseRoutes = require('./routes/sessionsSupabase');
// const adminRoutes = require('./routes/admin'); // Temporarily disabled due to missing controllers
const logsRoutes = require('./routes/logs');
const migrationRoutes = require('./routes/migration');
const aiTestRoutes = require('./routes/aiTest');
const { loggingMiddleware, errorLoggingMiddleware, requestLoggingMiddleware } = require('./middleware/loggingMiddleware');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // HTTP request logging
app.use(express.json()); // Parse JSON bodies

// Custom logging middleware
app.use(loggingMiddleware); // Add logging helpers to requests
// app.use(requestLoggingMiddleware); // Disabled - too much log noise

// Routes

app.use('/api/interviews', interviewRoutes);
app.use('/api/test-drafts', testDraftsRoutes);
app.use('/api/supabase', supabaseRoutes);
app.use('/api/supabase-auth', supabaseAuthRoutes);
app.use('/api/sessions-supabase', sessionsSupabaseRoutes);
// app.use('/api/admin', adminRoutes); // Temporarily disabled due to missing controllers
app.use('/api/logs', logsRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/ai', aiTestRoutes);

// API root route
app.get('/api', (req, res) => {
  res.send('Legamunity API is running');
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve React app for specific frontend routes
const frontendRoutes = ['/', '/login', '/register', '/dashboard', '/admin', '/profile', '/settings'];

frontendRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
