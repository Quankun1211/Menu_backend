import multer from "multer"

const storage = multer.diskStorage({})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"), false)
    }
    cb(null, true)
  }
})

export default upload
