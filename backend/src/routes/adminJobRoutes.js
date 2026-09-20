const express = require('express');

const {
  createJob,
  getJobs,
  getJobById,
  updateJob,
} = require('../controllers/adminJobController');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', getJobs);
router.get('/:id', getJobById);
router.post('/', createJob);
router.put('/:id', updateJob);

module.exports = router;