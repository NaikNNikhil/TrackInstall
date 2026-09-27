const express = require('express');

const {
  getAdmins,
  createAdmin,
  deactivateAdmin,
  reactivateAdmin,
} = require('../controllers/adminManagementController');

const {
  requireAuth,
  requireSuperAdmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireSuperAdmin);

// Get all admins
router.get('/', getAdmins);

// Create admin
router.post('/', createAdmin);

// Deactivate admin
router.patch('/:id/deactivate', deactivateAdmin);

// Reactivate admin
router.patch('/:id/reactivate', reactivateAdmin);

module.exports = router;