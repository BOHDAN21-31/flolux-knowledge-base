import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import { requireAuth } from '../auth.js';
import { processImage } from '../services/image-processor.js';

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
  'image/heic-sequence': { ext: 'heic', kind: 'image' },
  'image/heif-sequence': { ext: 'heic', kind: 'image' },
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
    let allowed = sniffed && ALLOWED[sniffed.mime];
    let resolvedMime = sniffed?.mime;
    // Фолбек для HEIC/HEIF з iPhone: file-type інколи не розпізнає — довіряємо
    // заявленому браузером MIME / розширенню .heic/.heif.
    if (!allowed) {
      const declared = String(req.file.mimetype || '').toLowerCase();
      const origName = String(req.file.originalname || '').toLowerCase();
      if (ALLOWED[declared]) { allowed = ALLOWED[declared]; resolvedMime = declared; }
      else if (/\.(heic|heif)$/.test(origName) || declared.includes('heic') || declared.includes('heif')) {
        allowed = ALLOWED['image/heic']; resolvedMime = 'image/heic';
      }
    }
    if (!allowed) {
      return res.status(400).json({ error: 'Недозволений тип файлу' });
    }

    const limit = allowed.kind === 'video' ? MAX_VIDEO : MAX_IMAGE;
    if (buf.length > limit) {
      const mb = Math.round(limit / (1024 * 1024));
      return res.status(400).json({ error: `Завеликий файл: ${allowed.kind === 'video' ? 'відео' : 'зображення'} до ${mb}MB` });
    }

    const filename = `${uuidv4()}.${allowed.ext}`;
    const fullPath = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(fullPath, buf);

    // Оптимізація+thumbnail для зображень (для відео — пропускається)
    let meta = null;
    if (allowed.kind === 'image') {
      meta = await processImage(fullPath, resolvedMime);
    }
    let outSize = buf.length;
    try { outSize = (await fs.promises.stat(fullPath)).size; } catch { /* keep */ }

    res.json({
      url: `/uploads/${filename}`,
      thumbnailUrl: meta?.thumbnailUrl || null,
      type: allowed.kind,
      size: outSize,
      mime: resolvedMime,
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
