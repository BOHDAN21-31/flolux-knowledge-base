import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

// Стискає/ресайзить зображення та робить thumbnail. Ніколи не кидає —
// при будь-якій помилці (зокрема HEIC без HEIF-підтримки) повертає null.
export async function processImage(filePath, mimeType) {
  try {
    if (!mimeType || !mimeType.startsWith('image/')) return null;

    const baseDir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));

    // Оптимізований оригінал (replace через .tmp)
    const tempPath = `${filePath}.tmp`;
    await sharp(filePath)
      .rotate() // авто-орієнтація з EXIF
      .resize({ width: 1920, withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toFile(tempPath);
    await fs.rename(tempPath, filePath);

    // Thumbnail 400x400
    const thumbName = `${baseName}_thumb.jpg`;
    const thumbPath = path.join(baseDir, thumbName);
    await sharp(filePath)
      .resize({ width: 400, height: 400, fit: 'cover' })
      .jpeg({ quality: 75 })
      .toFile(thumbPath);

    return { thumbnailUrl: `/uploads/${thumbName}` };
  } catch (e) {
    console.error('[image-processor]', e.message);
    return null;
  }
}
