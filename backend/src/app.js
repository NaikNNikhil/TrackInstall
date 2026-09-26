const express = require('express');
const cors = require('cors');
const path = require('path');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const adminCityRoutes = require('./routes/adminCityRoutes');
const adminInstallerRoutes = require('./routes/adminInstallerRoutes');
const adminJobRoutes = require('./routes/adminJobRoutes');
const orderFileRoutes = require('./routes/orderFileRoutes');
const installerJobRoutes = require('./routes/installerJobRoutes');
const installerVisitRoutes = require('./routes/installerVisitRoutes');
const adminVisitRoutes = require('./routes/adminVisitRoutes');
const adminPaymentRoutes = require('./routes/adminPaymentRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'))
);

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin/cities', adminCityRoutes);
app.use('/api/v1/admin/installers', adminInstallerRoutes);
app.use('/api/v1/admin/jobs', adminJobRoutes);
app.use('/api/v1/admin/jobs',orderFileRoutes);
app.use('/api/v1/installer/jobs', installerJobRoutes);
app.use('/api/v1/installer', installerVisitRoutes);
app.use('/api/v1/admin/visits', adminVisitRoutes);
app.use('/api/v1/admin/payments', adminPaymentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

module.exports = app;