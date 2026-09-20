const express = require('express');

const {
  getInstallerJobs,
  getInstallerJobById,
  completeInstallerJob,
} = require('../controllers/installerJobController');

const {
  requireAuth,
  requireInstaller,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireInstaller);

router.get('/', getInstallerJobs);
router.get('/:id', getInstallerJobById);
router.post('/:id/complete', completeInstallerJob);

module.exports = router;