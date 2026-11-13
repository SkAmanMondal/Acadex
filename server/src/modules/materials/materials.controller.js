import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import Material from './material.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { broadcastEvent } from '../../config/socket.js';
import { uploadMemory, uploadToStorage, deleteFromStorage, getFileAccessUrl } from '../../services/storage.service.js';

// Export upload middleware powered by memory storage (Cloudinary stream + local fallback)
export const uploadMiddleware = uploadMemory;

// Helper to determine clean Content-Type for streaming
const getMimeType = (fileName, fileType) => {
  const ext = (fileName ? fileName.split('.').pop() : fileType || '').toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'ppt': return 'application/vnd.ms-powerpoint';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
};

/**
 * Pipes a remote HTTP/HTTPS resource into an Express response, following redirects.
 */
const pipeRemoteStream = (url, res, maxRedirects = 3) => {
  if (maxRedirects < 0) {
    if (!res.headersSent) res.status(502).send('Too many redirects fetching file');
    return;
  }
  try {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (cRes) => {
      if ([301, 302, 307, 308].includes(cRes.statusCode) && cRes.headers.location) {
        return pipeRemoteStream(cRes.headers.location, res, maxRedirects - 1);
      }
      if (cRes.statusCode >= 400) {
        if (!res.headersSent) res.status(cRes.statusCode).send('Failed to fetch remote asset');
        return;
      }
      if (cRes.headers['content-length'] && !res.headersSent) {
        res.setHeader('Content-Length', cRes.headers['content-length']);
      }
      cRes.pipe(res);
    });

    req.on('error', (err) => {
      console.error('[MaterialStream] Error streaming file:', err.message);
      if (!res.headersSent) {
        res.status(500).send('Error streaming material file');
      }
    });
  } catch (err) {
    console.error('[MaterialStream] Exception:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Error initiating file stream');
    }
  }
};

/**
 * Universal Streaming Handler for Study Materials:
 * Supports both 'attachment' (direct file download) and 'inline' (direct browser rendering).
 */
export const streamMaterialFile = async (req, res, disposition = 'attachment') => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id);
    if (!material) return sendError(res, 'Study material not found', 404);

    if (disposition === 'attachment') {
      material.downloadCount = (material.downloadCount || 0) + 1;
      await material.save().catch(() => {});
    }

    const rawFilename = material.fileName || `study-material-${material._id}.${material.fileType || 'pdf'}`;
    const cleanFilename = rawFilename.replace(/["\r\n]/g, '_');
    const encodedFilename = encodeURIComponent(cleanFilename);
    const contentType = getMimeType(cleanFilename, material.fileType);

    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${cleanFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    if (disposition === 'inline') {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    const accessUrl = getFileAccessUrl(material);

    // If local file path
    if (
      material.storageType === 'local' ||
      accessUrl?.startsWith('/uploads/') ||
      (!accessUrl.startsWith('http://') && !accessUrl.startsWith('https://'))
    ) {
      const relativePath = accessUrl.replace(/^\/uploads\//, '');
      const localFilePath = path.resolve('uploads', relativePath);
      if (!fs.existsSync(localFilePath)) {
        const fallbackPath = path.resolve('../uploads', relativePath);
        if (fs.existsSync(fallbackPath)) {
          return fs.createReadStream(fallbackPath).pipe(res);
        }
        return res.status(404).send('File not found on server storage');
      }
      return fs.createReadStream(localFilePath).pipe(res);
    }

    // Remote file (Cloudinary CDN signed private download URL)
    pipeRemoteStream(accessUrl, res);
  } catch (err) {
    console.error('[streamMaterialFile] Error:', err);
    if (!res.headersSent) {
      return sendError(res, err.message, 500);
    }
  }
};

export const downloadMaterialFile = (req, res) => streamMaterialFile(req, res, 'attachment');
export const viewMaterialFile = (req, res) => streamMaterialFile(req, res, 'inline');

export const uploadMaterial = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 'Please provide a file to upload', 400);
    }

    const { title, description, subject, unit, topic, department } = req.body;

    const uploaded = await uploadToStorage(req.file, 'materials');

    const material = await Material.create({
      title,
      description,
      subject,
      unit: Number(unit) || 1,
      topic,
      department: department || req.user.department,
      teacher: req.user._id,
      fileUrl: uploaded.fileUrl,
      fileName: req.file.originalname,
      fileType: uploaded.fileType,
      fileSize: uploaded.fileSize,
      cloudinaryPublicId: uploaded.cloudinaryPublicId,
      storageType: uploaded.storageType,
    });

    const populated = await Material.findById(material._id)
      .populate('subject', 'name code')
      .populate('teacher', 'name email role avatar department');

    broadcastEvent('materials_updated', populated);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Study material uploaded successfully', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const getMaterials = async (req, res) => {
  try {
    const filter = {};
    if (['teacher', 'hod'].includes(req.user?.role)) {
      filter.$or = [
        { department: req.user.department },
        { teacher: req.user._id },
      ];
    } else if (req.query.department) {
      filter.department = req.query.department;
    }
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.unit) filter.unit = Number(req.query.unit);

    const materials = await Material.find(filter)
      .populate('subject', 'name code')
      .populate('teacher', 'name email role avatar department')
      .sort({ unit: 1, createdAt: -1 })
      .lean();

    const formatted = materials.map((m) => ({
      ...m,
      fileUrl: getFileAccessUrl(m),
    }));

    return sendSuccess(res, 'Materials retrieved successfully', formatted);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};


export const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, subject, unit, topic, department } = req.body;

    const material = await Material.findById(id);
    if (!material) return sendError(res, 'Material not found', 404);

    if (req.user.role === 'teacher' && material.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized to edit this material', 403);
    }

    if (title) material.title = title;
    if (description !== undefined) material.description = description;
    if (subject) material.subject = subject;
    if (unit !== undefined) material.unit = Number(unit);
    if (topic !== undefined) material.topic = topic;
    if (department) material.department = department;

    if (req.file) {
      if (material.fileUrl) {
        await deleteFromStorage(material.fileUrl, material.cloudinaryPublicId);
      }
      const uploaded = await uploadToStorage(req.file, 'materials');
      material.fileUrl = uploaded.fileUrl;
      material.fileName = req.file.originalname;
      material.fileType = uploaded.fileType;
      material.fileSize = uploaded.fileSize;
      material.cloudinaryPublicId = uploaded.cloudinaryPublicId;
      material.storageType = uploaded.storageType;
    }

    await material.save();
    const populated = await Material.findById(material._id)
      .populate('subject', 'name code')
      .populate('teacher', 'name email role avatar department');

    broadcastEvent('materials_updated', populated);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Study material updated successfully', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id);
    if (!material) return sendError(res, 'Material not found', 404);

    if (req.user.role === 'teacher' && material.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized to delete this material', 403);
    }

    if (material.fileUrl) {
      await deleteFromStorage(material.fileUrl, material.cloudinaryPublicId);
    }

    await Material.findByIdAndDelete(id);

    broadcastEvent('materials_updated', { id, deleted: true });
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Study material deleted successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export const incrementDownloadCount = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findByIdAndUpdate(
      id,
      { $inc: { downloadCount: 1 } },
      { new: true }
    );
    if (!material) return sendError(res, 'Material not found', 404);

    return sendSuccess(res, 'Download counted', { downloadCount: material.downloadCount });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
