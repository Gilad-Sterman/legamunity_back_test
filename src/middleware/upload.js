const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create interview-specific directory
    const interviewId = req.params.interviewId || 'unknown';
    const interviewDir = path.join(uploadsDir, interviewId);
    
    if (!fs.existsSync(interviewDir)) {
      fs.mkdirSync(interviewDir, { recursive: true });
    }
    
    cb(null, interviewDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${name}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

// File filter to accept audio and text files
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Audio files
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac',
    'audio/ogg', 'audio/webm', 'audio/flac',
    // Text files
    'text/plain', 'text/markdown', 'application/pdf',
    // Document files
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Please upload audio or text files only.`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

module.exports = upload;
