import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import { requireAuth } from '../auth.js';

const router = Router();

// Каталог зберігання: Railway Volume або локальний ./uploads
export const UPLOAD_DIR = path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;

// Дозволені типи за реальним вмістом (magic bytes через file-type)
const ALLOWED = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/heic': { ext: 'heic', kind: 'image' },
  'image/heif': { ext: 'heic', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO }, // жорсткий стелаж; точні ліміти — після визначення типу
});

// POST /api/upload — multipart/form-data, поле "file"
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не передано (поле "file")' });

    const buf = req.file.buffer;
    const sniffed = await fileTypeFromBuffer(buf);
    const allowed = sniffed && ALLOWED[sniffed.mime];
    if (!allowed) {
      return res.status(400).json({ error: 'Недозволений тип файлу' });
    }

    const limit = allowed.kind === 'video' ? MAX_VIDEO : MAX_IMAGE;
    if (buf.length > limit) {
      const mb = Math.round(limit / (1024 * 1024));
      return res.status(400).json({ error: `Завеликий файл: ${allowed.kind === 'video' ? 'відео' : 'зображення'} до ${mb}MB` });
    }

    const filename = `${uuidv4()}.${allowed.ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buf);

    res.json({
      url: `/uploads/${filename}`,
      type: allowed.kind,
      size: buf.length,
      mime: sniffed.mime,
    });
  } catch (e) {
    if (e instanceof multer.MulterError && e.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Завеликий файл (максимум 50MB)' });
    }
    console.error(e);
    res.status(500).json({ error: 'Помилка завантаження файлу' });
  }
});

export default router;
