const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes (to be created later)
// const authRoutes = require('./routes/auth');
// const userRoutes = require('./routes/users');
// const sessionRoutes = require('./routes/sessions');
const interviewRoutes = require('./routes/interviews');
// const adminRoutes = require('./routes/admin');
const testDraftsRoutes = require('./routes/test-drafts');
const supabaseRoutes = require('./routes/supabaseRoutes');
const supabaseAuthRoutes = require('./routes/supabaseAuth');
// const usersMigratedRoutes = require('./routes/usersMigrated');
const sessionsSupabaseRoutes = require('./routes/sessionsSupabase');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies

// Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/sessions', sessionRoutes);
app.use('/api/interviews', interviewRoutes);
// app.use('/api/admin', adminRoutes);
app.use('/api/test-drafts', testDraftsRoutes);
app.use('/api/supabase', supabaseRoutes);
app.use('/api/supabase-auth', supabaseAuthRoutes);
// app.use('/api/users-migrated', usersMigratedRoutes);
app.use('/api/sessions-supabase', sessionsSupabaseRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Legamunity API is running');
});

// Error handling middleware
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
