const express = require('express');

const {
  createInstallerVisit,
  getInstallerVisits,
} = require('../controllers/installerVisitController');

const {
  requireAuth,
  requireInstaller,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireInstaller);

router.get('/jobs/:id/visits', getInstallerVisits);
router.post('/jobs/:id/visits', createInstallerVisit);

module.exports = router;