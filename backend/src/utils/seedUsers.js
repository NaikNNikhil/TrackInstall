require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../config/database');

const seedSuperAdmin = async () => {
  try {
    const name = process.env.SUPER_ADMIN_NAME || 'TrackInstall Super Admin';
    const email =
      process.env.SUPER_ADMIN_EMAIL || 'superadmin@trackinstall.local';
    const phone =
      process.env.SUPER_ADMIN_PHONE || '9503165705';
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!password) {
      throw new Error(
        'SUPER_ADMIN_PASSWORD is not set in the environment.'
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO users
        (name, email, phone_number, password_hash, role, is_active)
      VALUES
        ($1, $2, $3, $4, 'SUPER_ADMIN', TRUE)
      ON CONFLICT (phone_number)
      DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        role = 'SUPER_ADMIN',
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        name,
        email,
        phone,
        passwordHash,
      ]
    );

    console.log('Super Admin seeded successfully.');
    console.log(`Phone: ${phone}`);

    await pool.end();
  } catch (error) {
    console.error('Seed Super Admin error:', error);
    await pool.end();
    process.exit(1);
  }
};

seedSuperAdmin();