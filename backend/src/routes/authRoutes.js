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

module.exports = router;