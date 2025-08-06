const fs = require('fs-extra');
const path = require('path');

// Define paths
const frontendBuildPath = path.join(__dirname, '../../frontend/build');
const backendPublicPath = path.join(__dirname, '../public');

// Function to copy files
async function copyFrontendBuild() {
  try {
    console.log('Copying frontend build files to backend public directory...');
    
    // Ensure the public directory exists
    await fs.ensureDir(backendPublicPath);
    
    // Remove existing files in the public directory
    await fs.emptyDir(backendPublicPath);
    
    // Copy the build directory to the public directory
    await fs.copy(frontendBuildPath, backendPublicPath);
    
    console.log('Frontend build files copied successfully!');
  } catch (error) {
    console.error('Error copying frontend build files:', error);
    process.exit(1);
  }
}

// Execute the copy function
copyFrontendBuild();
