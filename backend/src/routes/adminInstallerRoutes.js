const express = require('express');

const {
  getInstallers,
  getInstallerById,
  createInstaller,
  updateInstaller,
  resendActivation,
} = require('../controllers/adminInstallerController');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', getInstallers);
router.get('/:id', getInstallerById);
router.post('/', createInstaller);
router.post('/:id/resend-activation', resendActivation);
router.put('/:id', updateInstaller);

module.exports = router;