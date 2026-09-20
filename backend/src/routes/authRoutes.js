const express = require('express');

const { login } = require('../controllers/authController');
const {
  requireAuth,
  requireAdmin,
  requireInstaller,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);

router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      userId: req.user.userId,
      role: req.user.role,
    },
  });
});

router.get(
  '/admin-test',
  requireAuth,
  requireAdmin,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Admin access granted',
    });
  }
);

router.get(
  '/installer-test',
  requireAuth,
  requireInstaller,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Installer access granted',
    });
  }
);

module.exports = router;