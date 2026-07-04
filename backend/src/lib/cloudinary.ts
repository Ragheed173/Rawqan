import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import { env, cloudinaryEnabled } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

/** Streams an in-memory buffer to Cloudinary with automatic optimization. */
export function uploadBuffer(buffer: Buffer, folder = env.CLOUDINARY_UPLOAD_FOLDER): Promise<UploadResult> {
  if (!cloudinaryEnabled) {
    throw ApiError.internal('Cloudinary is not configured. Set CLOUDINARY_* env vars.');
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(ApiError.internal(error?.message ?? 'Upload failed'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export async function deleteAsset(publicId: string): Promise<void> {
  if (!cloudinaryEnabled || !publicId) return;
  await cloudinary.uploader.destroy(publicId);
}

export { cloudinaryEnabled };
