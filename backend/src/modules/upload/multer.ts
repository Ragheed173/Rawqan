import multer from 'multer';
import { ApiError } from '../../utils/ApiError.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** In-memory storage so buffers stream straight to Cloudinary (no disk writes). */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest('Unsupported file type. Use JPEG, PNG, WEBP or AVIF.'));
  },
});
