const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is required',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (
    req.user?.role !== 'ADMIN' &&
    req.user?.role !== 'SUPER_ADMIN'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Super Admin access required',
    });
  }

  next();
};

const requireInstaller = (req, res, next) => {
  if (req.user?.role !== 'INSTALLER') {
    return res.status(403).json({
      success: false,
      message: 'Installer access required',
    });
  }

  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireInstaller,
  requireSuperAdmin,
};