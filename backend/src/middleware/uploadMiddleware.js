const multer = require('multer');
const path = require('path');

const allowedExtensions = [
  '.pdf',
  '.xlsx',
  '.xls',
  '.doc',
  '.docx',
];

const storage = multer.memoryStorage();

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