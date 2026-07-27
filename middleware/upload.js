import multer from "multer"

const storage = multer.diskStorage({})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error("Only image files allowed"), false)
    }
    cb(null, true)
  }
})

export default upload
