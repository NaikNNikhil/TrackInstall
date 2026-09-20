require('dotenv').config();

const bcrypt = require('bcrypt');

const pool = require('../config/database');

const seedUsers = async () => {
  try {
    const password = 'TrackInstall@123';
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO users
        (name, email, phone_number, password_hash, role)
      VALUES
        ($1, $2, $3, $4, $5)
      ON CONFLICT (phone_number)
      DO NOTHING
      `,
      [
        'TrackInstall Admin',
        'admin@trackinstall.local',
        '9000000001',
        passwordHash,
        'ADMIN',
      ]
    );

    await pool.query(
      `
      INSERT INTO users
        (name, email, phone_number, password_hash, role)
      VALUES
        ($1, $2, $3, $4, $5)
      ON CONFLICT (phone_number)
      DO NOTHING
      `,
      [
        'Rahul Patil',
        null,
        '9000000002',
        passwordHash,
        'INSTALLER',
      ]
    );

    console.log('Development users seeded successfully.');

    await pool.end();
  } catch (error) {
    console.error('Seed users error:', error);
    await pool.end();
    process.exit(1);
  }
};

seedUsers();