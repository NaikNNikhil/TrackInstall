const express = require('express');

const {
  getCities,
  getCityById,
  createCity,
  updateCity,
} = require('../controllers/adminCityController');

const {
  requireAuth,
  requireAdmin,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', getCities);

router.get('/:id', getCityById);

router.post('/', createCity);

router.put('/:id', updateCity);

module.exports = router;