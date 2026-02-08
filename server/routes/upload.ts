import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middleware/auth.js";
import { generateFilename, getUploadPath, getPublicUrl, deleteFile, filenameFromUrl, UPLOAD_DIR, type BucketName } from "../services/storage.js";

// ─── Allowed file types per bucket ──────────────────────────────────
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const DOCUMENT_MIMES = new Set([
  ...IMAGE_MIMES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const ALLOWED_MIMES: Record<BucketName, Set<string>> = {
  avatars: IMAGE_MIMES,
  logos: IMAGE_MIMES,
  menus: new Set([...IMAGE_MIMES, "application/pdf"]),
  documents: DOCUMENT_MIMES,
  attachments: DOCUMENT_MIMES,
};

const ALLOWED_EXTENSIONS: Record<BucketName, Set<string>> = {
  avatars: new Set([".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]),
  logos: new Set([".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"]),
  menus: new Set([".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".pdf"]),
  documents: new Set([".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt"]),
  attachments: new Set([".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt"]),
};

function createFileFilter(bucket: BucketName) {
  const allowedMimes = ALLOWED_MIMES[bucket];
  const allowedExts = ALLOWED_EXTENSIONS[bucket];

  return (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.has(file.mimetype) && allowedExts.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Dateityp nicht erlaubt. Erlaubt: ${[...allowedExts].join(", ")}`));
    }
  };
}

// ─── Multer setup ───────────────────────────────────────────────────
function createBucketUpload(bucket: BucketName) {
  const bucketStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOAD_DIR, bucket));
    },
    filename: (_req, file, cb) => {
      cb(null, generateFilename(file.originalname));
    },
  });

  return multer({
    storage: bucketStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: createFileFilter(bucket),
  });
}

const router = Router();

// Generic upload handler factory
function uploadHandler(bucket: BucketName) {
  const bucketUpload = createBucketUpload(bucket);

  return [
    (req: any, res: any, next: any) => {
      bucketUpload.single("file")(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ error: "Datei ist zu gross. Maximal 10 MB erlaubt." });
          }
          return res.status(400).json({ error: err.message });
        }
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        next();
      });
    },
    async (req: any, res: any) => {
      const user = await requireAuth(req, res);
      if (!user) return;

      if (!req.file) {
        return res.status(400).json({ error: "Keine Datei hochgeladen." });
      }

      const publicUrl = getPublicUrl(bucket, req.file.filename);

      // Optionally delete old file if provided
      const oldUrl = req.body?.old_url;
      if (oldUrl) {
        const oldFilename = filenameFromUrl(oldUrl);
        if (oldFilename) {
          deleteFile(bucket, oldFilename);
        }
      }

      return res.status(200).json({
        url: publicUrl,
        filename: req.file.filename,
      });
    },
  ];
}

router.post("/avatar", ...uploadHandler("avatars"));
router.post("/logo", ...uploadHandler("logos"));
router.post("/document", ...uploadHandler("documents"));
router.post("/menu", ...uploadHandler("menus"));
router.post("/attachment", ...uploadHandler("attachments"));

export default router;
