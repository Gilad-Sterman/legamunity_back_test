/**
 * Cloudinary Service
 * Handles file uploads to Cloudinary cloud storage
 */
const cloudinary = require('cloudinary').v2;
const { promisify } = require('util');
const fs = require('fs');
const unlinkAsync = promisify(fs.unlink);
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file to Cloudinary
 * @param {Object} file - The file object from multer
 * @param {string} interviewId - The interview ID
 * @param {string} fileType - Type of file (audio, text)
 * @returns {Promise<Object>} - Upload result with file URL and metadata
 */
const uploadFile = async (file, interviewId, fileType) => {
  try {
    // Create a folder structure based on interview ID
    const folder = `interviews/${interviewId}`;
    
    // Generate a unique public_id to avoid conflicts
    const publicId = `${folder}/${fileType}_${uuidv4()}`;
    
    // Upload the file to Cloudinary from memory buffer
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: getResourceType(file.mimetype),
          public_id: publicId,
          folder: folder,
          overwrite: true,
          use_filename: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });
    
    // Save file URL to database
    const fileData = {
      interview_id: interviewId,
      file_type: fileType,
      original_filename: file.originalname,
      cloudinary_public_id: uploadResult.public_id,
      cloudinary_url: uploadResult.secure_url,
      mime_type: file.mimetype,
      file_size: file.size
    };
    
    // Insert into file_urls table
    const { data, error } = await db
      .from('file_urls')
      .upsert(fileData, { onConflict: ['interview_id', 'file_type'] })
      .select();
      
    if (error) throw new Error(`Database error: ${error.message}`);
    
    return {
      success: true,
      data: {
        ...fileData,
        id: data[0]?.id
      }
    };
  } catch (error) {
    console.error('Error uploading file to Cloudinary:', error);
    
    // Try to delete the temporary file if it exists
    try {
      if (file.path && fs.existsSync(file.path)) {
        await unlinkAsync(file.path);
      }
    } catch (unlinkError) {
      console.error('Error deleting temporary file:', unlinkError);
    }
    
    throw error;
  }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - The public ID of the file
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return { success: true, result };
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

/**
 * Get file URLs for an interview
 * @param {string} interviewId - The interview ID
 * @returns {Promise<Array>} - Array of file URLs
 */
const getFileUrls = async (interviewId) => {
  try {
    const { data, error } = await db
      .from('file_urls')
      .select('*')
      .eq('interview_id', interviewId);
      
    if (error) throw new Error(`Database error: ${error.message}`);
    
    return { success: true, data };
  } catch (error) {
    console.error('Error getting file URLs:', error);
    throw error;
  }
};

/**
 * Determine the resource type based on MIME type
 * @param {string} mimeType - The MIME type of the file
 * @returns {string} - Cloudinary resource type
 */
const getResourceType = (mimeType) => {
  if (mimeType.startsWith('audio/')) return 'video'; // Cloudinary uses 'video' for audio files
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'raw'; // For text files, PDFs, etc.
};

module.exports = {
  uploadFile,
  deleteFile,
  getFileUrls
};
