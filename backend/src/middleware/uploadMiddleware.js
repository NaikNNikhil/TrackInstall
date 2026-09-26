const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirectory = path.join(
  process.cwd(),
  'uploads',
  'order-forms'
);

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const allowedExtensions = [
  '.pdf',
  '.xlsx',
  '.xls',
  '.doc',
  '.docx',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const safeName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '_');

    cb(
      null,
      `${Date.now()}-${safeName}${extension}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path
    .extname(file.originalname || '')
    .toLowerCase();

  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (
    allowedExtensions.includes(extension) ||
    allowedMimeTypes.includes(file.mimetype)
  ) {
    return cb(null, true);
  }

  cb(
    new Error(
      'Only PDF, Excel, and Word files are allowed.'
    )
  );
};

const uploadOrderFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = {
  uploadOrderFile,
};