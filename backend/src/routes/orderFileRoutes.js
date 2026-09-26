const express = require('express');

const {
  uploadOrderFile,
  getOrderFile,
} = require('../controllers/orderFileController');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/authMiddleware');

const {
  uploadOrderFile: upload,
} = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(
  requireAuth,
  requireAdmin
);

router.post(
  '/:id/order-file',
  upload.single('file'),
  uploadOrderFile
);

router.get(
  '/:id/order-file',
  getOrderFile
);

module.exports = router;