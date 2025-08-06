// CLEANUP: Authentication Migration Utility commented out - using Supabase only
// TODO: Safe to delete after confirming no dependencies

/*
/**
 * Authentication Migration Utility
 * Helps manage the gradual migration from Firebase to Supabase authentication
 */

const firebaseAuth = require('../middleware/auth');
const supabaseAuth = require('../middleware/supabaseAuth');

/**
 * Migration strategy configuration
 * Set which routes should use which authentication method
 */
const MIGRATION_CONFIG = {
  // Routes that should use Supabase auth only
  supabaseOnly: [
    '/api/supabase-auth/*',
    '/api/supabase/*'
  ],
  
  // Routes that should use hybrid auth (both Firebase and Supabase)
  hybrid: [
    '/api/users/*',
    '/api/sessions/*',
    '/api/interviews/*',
    '/api/admin/*'
  ],
  
  // Routes that should still use Firebase auth only
  firebaseOnly: [
    // Add any routes that must remain on Firebase for now
  ]
};

/**
 * Get the appropriate auth middleware based on migration strategy
 */
function getAuthMiddleware(routePath, strategy = 'auto') {
  if (strategy === 'supabase') {
    return {
      verifyToken: supabaseAuth.verifyToken,
      requireAdmin: supabaseAuth.requireAdmin,
      requireRole: supabaseAuth.requireRole
    };
  }
  
  if (strategy === 'firebase') {
    return {
      verifyToken: firebaseAuth.verifyToken,
      requireAdmin: firebaseAuth.requireAdmin
    };
  }
  
  if (strategy === 'hybrid') {
    return {
      verifyToken: supabaseAuth.verifyTokenHybrid,
      requireAdmin: supabaseAuth.requireAdmin,
      requireRole: supabaseAuth.requireRole,
      logProvider: supabaseAuth.logAuthProvider
    };
  }
  
  // Auto strategy - determine based on route path
  if (strategy === 'auto') {
    // Check if route should use Supabase only
    if (MIGRATION_CONFIG.supabaseOnly.some(pattern => 
      routePath.match(pattern.replace('*', '.*')))) {
      return getAuthMiddleware(routePath, 'supabase');
    }
    
    // Check if route should use Firebase only
    if (MIGRATION_CONFIG.firebaseOnly.some(pattern => 
      routePath.match(pattern.replace('*', '.*')))) {
      return getAuthMiddleware(routePath, 'firebase');
    }
    
    // Default to hybrid for other routes
    return getAuthMiddleware(routePath, 'hybrid');
  }
  
  // Default fallback
  return getAuthMiddleware(routePath, 'hybrid');
}

/**
 * Wrapper function to create protected routes with automatic auth selection
 */
function createProtectedRoute(routePath, strategy = 'auto') {
  const auth = getAuthMiddleware(routePath, strategy);
  
  return {
    // Basic authentication
    authenticate: auth.verifyToken,
    
    // Admin-only authentication
    authenticateAdmin: [auth.verifyToken, auth.requireAdmin],
    
    // Role-based authentication
    authenticateRole: (role) => [auth.verifyToken, auth.requireRole(role)],
    
    // Authentication with logging (for monitoring migration)
    authenticateWithLogging: auth.logProvider ? 
      [auth.verifyToken, auth.logProvider] : 
      [auth.verifyToken],
    
    // Get the auth configuration for this route
    getConfig: () => ({
      routePath,
      strategy,
      authProvider: strategy === 'firebase' ? 'firebase' : 
                   strategy === 'supabase' ? 'supabase' : 'hybrid'
    })
  };
}

/**
 * Migration status checker
 */
function getMigrationStatus() {
  return {
    supabaseOnlyRoutes: MIGRATION_CONFIG.supabaseOnly.length,
    hybridRoutes: MIGRATION_CONFIG.hybrid.length,
    firebaseOnlyRoutes: MIGRATION_CONFIG.firebaseOnly.length,
    totalManagedRoutes: MIGRATION_CONFIG.supabaseOnly.length + 
                       MIGRATION_CONFIG.hybrid.length + 
                       MIGRATION_CONFIG.firebaseOnly.length,
    migrationProgress: {
      fullyMigrated: MIGRATION_CONFIG.supabaseOnly.length,
      inProgress: MIGRATION_CONFIG.hybrid.length,
      notStarted: MIGRATION_CONFIG.firebaseOnly.length
    }
  };
}

/**
 * Update migration configuration
 */
function updateMigrationConfig(routePath, newStrategy) {
  // Remove route from all existing configurations
  Object.keys(MIGRATION_CONFIG).forEach(strategy => {
    MIGRATION_CONFIG[strategy] = MIGRATION_CONFIG[strategy].filter(
      route => route !== routePath
    );
  });
  
  // Add to new strategy
  if (newStrategy === 'supabase') {
    MIGRATION_CONFIG.supabaseOnly.push(routePath);
  } else if (newStrategy === 'firebase') {
    MIGRATION_CONFIG.firebaseOnly.push(routePath);
  } else if (newStrategy === 'hybrid') {
    MIGRATION_CONFIG.hybrid.push(routePath);
  }
  
  console.log(`Migration: Route ${routePath} moved to ${newStrategy} strategy`);
}

module.exports = {
  getAuthMiddleware,
  createProtectedRoute,
  getMigrationStatus,
  updateMigrationConfig,
  MIGRATION_CONFIG
};
