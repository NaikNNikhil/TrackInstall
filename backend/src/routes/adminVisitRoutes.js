const express = require('express');

const {
  getAdminVisits,
  getPendingVisitApprovals,
  updateVisitApproval,
} = require('../controllers/adminVisitController');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', getAdminVisits);

router.get('/pending', getPendingVisitApprovals);

router.put('/:id/status', updateVisitApproval);

module.exports = router;