const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifier and password are required',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        phone_number,
        password_hash,
        role,
        is_active
      FROM users
      WHERE email = $1
         OR phone_number = $1
      LIMIT 1
      `,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive',
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phone_number,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

const activateAccount = async (req, res) => {
  try {
    const { activationToken, password } = req.body;

    if (!activationToken || !password) {
      return res.status(400).json({
        success: false,
        message: 'Activation token and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    const activationTokenHash = crypto
      .createHash('sha256')
      .update(activationToken)
      .digest('hex');

    const result = await pool.query(
      `
      SELECT
        id,
        role,
        is_active,
        activation_expires_at
      FROM users
      WHERE activation_token_hash = $1
      LIMIT 1
      `,
      [activationTokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activation token',
      });
    }

    const user = result.rows[0];

    if (user.activation_expires_at <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Activation token has expired',
      });
    }

    if (user.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Account is already activated',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(`
      UPDATE users
      SET
        password_hash = $1,
        is_active = TRUE,
        activation_token_hash = NULL,
        activation_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [passwordHash, user.id]);

    await pool.query(`
      UPDATE installers
      SET
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `, [user.id]);

    return res.status(200).json({
      success: true,
      message: 'Account activated successfully',
    });
  } catch (error) {
    console.error('Account activation error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to activate account',
    });
  }
};

module.exports = {
  login,
  activateAccount,
};