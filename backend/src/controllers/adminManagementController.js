const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/database');

const ACTIVATION_EXPIRY_HOURS = 24;

// Get all admins
const getAdmins = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.role IN ('ADMIN', 'SUPER_ADMIN')
      ORDER BY
        CASE
          WHEN u.role = 'SUPER_ADMIN' THEN 0
          ELSE 1
        END,
        u.name ASC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get admins error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admins',
    });
  }
};

// Create a new admin
const createAdmin = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      email,
      phoneNumber,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    if (!phoneNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    await client.query('BEGIN');

    // Check duplicate phone/email
    const existingUser = await client.query(
      `
      SELECT id
      FROM users
      WHERE phone_number = $1
         OR ($2::VARCHAR IS NOT NULL AND email = $2)
      LIMIT 1
      `,
      [
        phoneNumber.trim(),
        email?.trim() || null,
      ]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        success: false,
        message: 'A user with this phone number or email already exists',
      });
    }

    // Generate one-time activation code
    const activationToken = crypto
      .randomBytes(6)
      .toString('base64url')
      .slice(0, 8)
      .toUpperCase();

    const activationTokenHash = crypto
      .createHash('sha256')
      .update(activationToken)
      .digest('hex');

    const activationExpiresAt = new Date(
      Date.now() +
        ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000
    );

    const userResult = await client.query(
      `
      INSERT INTO users (
        name,
        email,
        phone_number,
        password_hash,
        role,
        is_active,
        activation_token_hash,
        activation_expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        NULL,
        'ADMIN',
        FALSE,
        $4,
        $5
      )
      RETURNING
        id,
        name,
        email,
        phone_number,
        role,
        is_active,
        created_at
      `,
      [
        name.trim(),
        email?.trim() || null,
        phoneNumber.trim(),
        activationTokenHash,
        activationExpiresAt,
      ]
    );

    await client.query('COMMIT');

    const response = {
      success: true,
      message: 'Admin created successfully',
      data: userResult.rows[0],
    };

    // Development-only activation code.
    // Do not expose this in production.
    if (process.env.NODE_ENV !== 'production') {
      response.activationToken = activationToken;
      response.activationExpiresAt = activationExpiresAt;
    }

    return res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Create admin error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create admin',
    });
  } finally {
    client.release();
  }
};

// Deactivate an admin
const deactivateAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    if (req.user?.userId === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND role = 'ADMIN'
      RETURNING
        id,
        name,
        email,
        phone_number,
        role,
        is_active,
        updated_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin deactivated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Deactivate admin error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate admin',
    });
  }
};

// Reactivate an admin
const reactivateAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND role = 'ADMIN'
      RETURNING
        id,
        name,
        email,
        phone_number,
        role,
        is_active,
        updated_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin reactivated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Reactivate admin error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to reactivate admin',
    });
  }
};

module.exports = {
  getAdmins,
  createAdmin,
  deactivateAdmin,
  reactivateAdmin,
};