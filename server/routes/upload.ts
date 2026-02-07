import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth } from "../middleware/auth.js";
import { generateFilename, getUploadPath, getPublicUrl, deleteFile, filenameFromUrl, UPLOAD_DIR, type BucketName } from "../services/storage.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Will be overridden per route
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

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
    limits: { fileSize: 10 * 1024 * 1024 },
  });
}

const router = Router();

// Generic upload handler factory
function uploadHandler(bucket: BucketName) {
  const bucketUpload = createBucketUpload(bucket);

  return [
    bucketUpload.single("file"),
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
