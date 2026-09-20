const express = require('express');

const {
  getPayments,
  getJobPayment,
  createPayment,
  markPaymentPaid,
} = require('../controllers/adminPaymentController');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', getPayments);

router.get('/jobs/:jobId', getJobPayment);

router.post('/jobs/:jobId', createPayment);

router.post('/jobs/:jobId/mark-paid', markPaymentPaid);

module.exports = router;