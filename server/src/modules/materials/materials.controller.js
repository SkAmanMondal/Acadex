import Material from './material.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { broadcastEvent } from '../../config/socket.js';
import { uploadMemory, uploadToStorage, deleteFromStorage, getFileAccessUrl } from '../../services/storage.service.js';

// Export upload middleware powered by memory storage (Cloudinary stream + local fallback)
export const uploadMiddleware = uploadMemory;

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

export const downloadMaterialFile = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id);
    if (!material) return sendError(res, 'Material not found', 404);

    material.downloadCount = (material.downloadCount || 0) + 1;
    await material.save();

    const accessUrl = getFileAccessUrl(material);
    return res.redirect(accessUrl);
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
