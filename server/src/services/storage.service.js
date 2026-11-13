import path from 'path';
import fs from 'fs';
import multer from 'multer';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

// Multer memory storage - preserves buffer for Cloudinary stream or local disk fallback
const memoryStorage = multer.memoryStorage();

export const uploadMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/**
 * Upload a file either to Cloudinary (if configured) or fallback to local disk.
 * @param {Object} file - Express multer file object (with .buffer, .originalname, .size, .mimetype)
 * @param {string} folder - Folder category ('materials', 'assignments', 'profiles', etc.)
 * @returns {Promise<{ fileUrl: string, cloudinaryPublicId: string|null, fileSize: number, fileType: string, storageType: 'cloudinary'|'local' }>}
 */
export const uploadToStorage = async (file, folder = 'general') => {
  if (!file || !file.buffer) {
    throw new Error('No file buffer provided for upload');
  }

  const extension = path.extname(file.originalname).replace('.', '').toLowerCase();

  // 1. Upload to Cloudinary if configured
  if (isCloudinaryConfigured) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `acadex/${folder}`,
            resource_type: 'auto',
            use_filename: true,
            unique_filename: true,
          },
          (error, res) => {
            if (error) return reject(error);
            resolve(res);
          }
        );
        stream.end(file.buffer);
      });

      return {
        fileUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
        fileSize: result.bytes || file.size,
        fileType: result.format || extension,
        storageType: 'cloudinary',
      };
    } catch (err) {
      console.error('[StorageService] Cloudinary upload rejected:', err.message);
      if (
        err.http_code === 403 ||
        err.message?.includes('missing permissions') ||
        err.message?.includes('actions=["create"]')
      ) {
        throw new Error(
          'Cloudinary upload rejected: Your API Key is missing "Write/Create" permissions in Cloudinary. Please edit your key in Cloudinary Console or use your Master API Key.'
        );
      }
      throw new Error(`Cloudinary upload failed: ${err.message || 'Unknown error'}`);
    }
  }

  // 2. Local disk fallback (if Cloudinary is unconfigured or unavailable)
  const targetDir = path.resolve(`uploads/${folder}`);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\s+/g, '_')}`;
  const targetPath = path.join(targetDir, safeFilename);

  await fs.promises.writeFile(targetPath, file.buffer);

  return {
    fileUrl: `/uploads/${folder}/${safeFilename}`,
    cloudinaryPublicId: null,
    fileSize: file.size || file.buffer.length,
    fileType: extension,
    storageType: 'local',
  };
};

/**
 * Delete a file from Cloudinary or local disk
 * @param {string} fileUrl - URL of file
 * @param {string} [cloudinaryPublicId] - Optional Cloudinary public_id
 */
export const deleteFromStorage = async (fileUrl, cloudinaryPublicId = null) => {
  try {
    // 1. Delete from Cloudinary if public ID is provided
    if (cloudinaryPublicId && isCloudinaryConfigured) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'auto' });
      } catch (err) {
        // Fallback try raw resource type if auto fails
        await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'raw' }).catch(() => {});
      }
      return true;
    }

    // 2. Delete from local disk if it's a local /uploads/ URL
    if (fileUrl && fileUrl.startsWith('/uploads/')) {
      const relativePath = fileUrl.replace(/^\/uploads\//, '');
      const localFilePath = path.resolve('uploads', relativePath);
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath);
        return true;
      }
    }
  } catch (err) {
    console.warn('[StorageService] Error during file deletion:', err.message);
  }
  return false;
};
