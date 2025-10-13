/**
 * File Upload Security Middleware
 * 
 * Provides comprehensive security for file uploads including:
 * - MIME type validation
 * - File extension whitelist
 * - Magic number/file signature verification
 * - Filename sanitization
 * - Size limits
 * - Virus scanning hooks (for future ClamAV integration)
 * 
 * Usage:
 *   const upload = createSecureUploader(allowedTypes);
 *   app.post('/upload', upload.single('file'), handler);
 */

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import crypto from 'crypto';

/**
 * Allowed file types configuration
 */
export const ALLOWED_FILE_TYPES = {
  documents: {
    mimeTypes: [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/csv',
      'text/plain',
    ],
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  images: {
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/tiff',
    ],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  taxDocuments: {
    mimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ],
    extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff'],
    maxSize: 25 * 1024 * 1024, // 25MB
  },
  all: {
    mimeTypes: ['*/*'],
    extensions: ['*'],
    maxSize: 50 * 1024 * 1024, // 50MB fallback
  },
};

/**
 * File signature (magic numbers) for verification
 * First few bytes that uniquely identify file types
 */
const FILE_SIGNATURES: Record<string, Buffer[]> = {
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  'image/jpeg': [
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]),
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE2]),
  ],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/gif': [
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
  ],
  'application/zip': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // ZIP (for .docx, .xlsx)
  'text/plain': [], // Text files don't have a reliable signature
  'text/csv': [],
};

/**
 * Sanitize filename to prevent directory traversal and injection attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let sanitized = filename.replace(/[\/\\]/g, '');
  
  // Remove any non-printable or dangerous characters
  sanitized = sanitized.replace(/[^\w\s\-\.]/g, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\.\s]+|[\.\s]+$/g, '');
  
  // Limit length
  const maxLength = 200;
  if (sanitized.length > maxLength) {
    const ext = path.extname(sanitized);
    const basename = path.basename(sanitized, ext);
    sanitized = basename.substring(0, maxLength - ext.length) + ext;
  }
  
  // If empty after sanitization, generate random name
  if (!sanitized || sanitized.length === 0) {
    sanitized = `file_${crypto.randomBytes(8).toString('hex')}`;
  }
  
  return sanitized;
}

/**
 * Verify file signature (magic numbers) matches claimed MIME type
 */
export function verifyFileSignature(buffer: Buffer, mimeType: string): boolean {
  const signatures = FILE_SIGNATURES[mimeType];
  
  // If no signature defined, skip verification (e.g., text files)
  if (!signatures || signatures.length === 0) {
    return true;
  }
  
  // Check if buffer starts with any of the valid signatures
  return signatures.some(signature => {
    if (buffer.length < signature.length) {
      return false;
    }
    
    return buffer.subarray(0, signature.length).equals(signature);
  });
}

/**
 * Virus scanning hook - ready for ClamAV integration
 * 
 * To enable ClamAV scanning:
 * 1. Install ClamAV: apt-get install clamav clamav-daemon
 * 2. Install Node.js client: npm install clamscan
 * 3. Set ENABLE_VIRUS_SCANNING=true in environment
 * 4. Uncomment ClamAV integration code below
 */
export async function scanFileForViruses(buffer: Buffer, filename: string): Promise<{ clean: boolean; threat?: string }> {
  // Check if virus scanning is enabled
  if (process.env.ENABLE_VIRUS_SCANNING !== 'true') {
    return { clean: true };
  }
  
  try {
    // TODO: Integrate with ClamAV when available
    // Example ClamAV integration:
    /*
    const NodeClam = require('clamscan');
    const clamscan = await new NodeClam().init({
      clamdscan: {
        socket: '/var/run/clamav/clamd.ctl',
        timeout: 60000,
      },
    });
    
    const { isInfected, viruses } = await clamscan.scanBuffer(buffer);
    
    if (isInfected) {
      console.error(`🦠 Virus detected in ${filename}: ${viruses.join(', ')}`);
      return { clean: false, threat: viruses.join(', ') };
    }
    */
    
    // For now, return clean (no scanning)
    return { clean: true };
  } catch (error) {
    console.error('Virus scanning error:', error);
    // Fail secure - reject file if scanning fails in production
    if (process.env.NODE_ENV === 'production') {
      return { clean: false, threat: 'Virus scan failed' };
    }
    return { clean: true };
  }
}

/**
 * Create secure file uploader with validation
 */
export function createSecureUploader(
  allowedType: keyof typeof ALLOWED_FILE_TYPES = 'documents',
  options: {
    enableSignatureVerification?: boolean;
    enableVirusScanning?: boolean;
    customMaxSize?: number;
  } = {}
) {
  const {
    enableSignatureVerification = true,
    enableVirusScanning = false,
    customMaxSize,
  } = options;
  
  const config = ALLOWED_FILE_TYPES[allowedType];
  const maxSize = customMaxSize || config.maxSize;
  
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSize,
      files: 1, // Single file upload by default
    },
    fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      // 1. Sanitize filename
      file.originalname = sanitizeFilename(file.originalname);
      
      // 2. Check file extension
      const ext = path.extname(file.originalname).toLowerCase();
      const allowsAllExtensions = config.extensions.includes('*');
      
      if (!allowsAllExtensions && !config.extensions.includes(ext)) {
        return cb(new Error(
          `Invalid file type. Allowed extensions: ${config.extensions.join(', ')}`
        ));
      }
      
      // 3. Check MIME type
      const allowsAllMimeTypes = config.mimeTypes.includes('*/*');
      
      if (!allowsAllMimeTypes && !config.mimeTypes.includes(file.mimetype)) {
        return cb(new Error(
          `Invalid file MIME type: ${file.mimetype}. Allowed types: ${config.mimeTypes.join(', ')}`
        ));
      }
      
      // 4. Additional validation will happen in the route handler
      // (file signature verification requires buffer, which is only available after upload)
      
      cb(null, true);
    },
  });
}

/**
 * Middleware to verify file after upload (signature + virus scan)
 * Use this AFTER multer middleware
 */
export async function verifyUploadedFile(
  req: Request,
  enableSignatureVerification = true,
  enableVirusScanning = false
): Promise<{ valid: boolean; error?: string }> {
  const file = req.file;
  
  if (!file || !file.buffer) {
    return { valid: false, error: 'No file uploaded' };
  }
  
  // 1. Verify file signature (magic numbers)
  if (enableSignatureVerification) {
    const signatureValid = verifyFileSignature(file.buffer, file.mimetype);
    
    if (!signatureValid) {
      console.warn(`⚠️ File signature mismatch: ${file.originalname} (claimed: ${file.mimetype})`);
      return {
        valid: false,
        error: 'File signature does not match claimed type. Possible file spoofing attempt.',
      };
    }
  }
  
  // 2. Virus scanning
  if (enableVirusScanning) {
    const scanResult = await scanFileForViruses(file.buffer, file.originalname);
    
    if (!scanResult.clean) {
      console.error(`🦠 Virus detected in uploaded file: ${file.originalname}`);
      return {
        valid: false,
        error: `File rejected: ${scanResult.threat || 'Virus detected'}`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Express middleware wrapper for file verification
 */
export function verifyFileMiddleware(
  enableSignatureVerification = true,
  enableVirusScanning = false
) {
  return async (req: Request, res: any, next: any) => {
    const result = await verifyUploadedFile(req, enableSignatureVerification, enableVirusScanning);
    
    if (!result.valid) {
      return res.status(400).json({
        error: result.error || 'File validation failed',
      });
    }
    
    next();
  };
}

/**
 * Get file hash for integrity verification
 */
export function getFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
