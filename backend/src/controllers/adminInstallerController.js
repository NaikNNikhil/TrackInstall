const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/database');

const getInstallers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        u.id AS user_id,
        u.name,
        u.email,
        u.phone_number,
        c.id AS city_id,
        c.name AS city_name,
        i.is_active,
        i.visiting_charge,
        i.created_at,
        i.updated_at
      FROM installers i
      JOIN users u ON u.id = i.user_id
      JOIN cities c ON c.id = i.city_id
      ORDER BY u.name ASC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get installers error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch installers',
    });
  }
};

const getInstallerById = async (req, res) => {
  try {
    const { id } = req.params;

    const installerResult = await pool.query(
      `
      SELECT
        i.id,
        u.id AS user_id,
        u.name,
        u.email,
        u.phone_number,
        c.id AS city_id,
        c.name AS city_name,
        i.is_active,
        i.visiting_charge,
        i.created_at,
        i.updated_at
      FROM installers i
      JOIN users u ON u.id = i.user_id
      JOIN cities c ON c.id = i.city_id
      WHERE i.id = $1
      `,
      [id]
    );

    if (installerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Installer not found',
      });
    }

    const installer = installerResult.rows[0];

    const chargesResult = await pool.query(
      `
      SELECT
        dt.id AS door_type_id,
        dt.name AS door_type,
        idc.installation_charge,
        idc.effective_from
      FROM installer_door_charges idc
      JOIN door_types dt ON dt.id = idc.door_type_id
      WHERE idc.installer_id = $1
      ORDER BY dt.id
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...installer,
        doorCharges: chargesResult.rows,
      },
    });
  } catch (error) {
    console.error('Get installer error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch installer',
    });
  }
};

const createInstaller = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      email,
      phoneNumber,
      cityId,
      visitingCharge,
      doorCharges,
      isActive = true,
    } = req.body;

    if (!name || !phoneNumber || !cityId) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone number and city are required',
      });
    }

    if (!Array.isArray(doorCharges)) {
      return res.status(400).json({
        success: false,
        message: 'doorCharges must be an array',
      });
    }

    await client.query('BEGIN');

    const cityResult = await client.query(
      `
      SELECT id
      FROM cities
      WHERE id = $1
        AND is_active = TRUE
      `,
      [cityId]
    );

    if (cityResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive city',
      });
    }

    const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenHash = crypto
        .createHash('sha256')
        .update(activationToken)
        .digest('hex');

      const activationExpiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
    ); // 24 hours from now

    const userResult = await client.query(
      `
      INSERT INTO users
        (
          name,
          email,
          phone_number,
          password_hash,
          role,
          is_active,
          activation_token_hash,
          activation_expires_at
        )
      VALUES
        ($1, $2, $3, NULL, 'INSTALLER', FALSE, $4, $5)
      RETURNING id, name, email, phone_number, role, is_active
      `,
      [
        name,
        email || null,
        phoneNumber,
        activationTokenHash,
        activationExpiresAt,
      ]
    );

    const user = userResult.rows[0];

    const installerResult = await client.query(
      `
      INSERT INTO installers
        (user_id, city_id, visiting_charge, is_active)
      VALUES
        ($1, $2, $3, $4)
      RETURNING id, user_id, city_id, visiting_charge, is_active
      `,
      [
        user.id,
        cityId,
        Number(visitingCharge || 0),
        Boolean(isActive),
      ]
    );

    const installer = installerResult.rows[0];

    for (const charge of doorCharges) {
      await client.query(
        `
        INSERT INTO installer_door_charges
          (
            installer_id,
            door_type_id,
            installation_charge,
            visiting_charge
          )
        VALUES
          ($1, $2, $3, $4)
        `,
        [
          installer.id,
          charge.doorTypeId,
          Number(charge.installationCharge || 0),
          Number(visitingCharge || 0),
        ]
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs
        (
          user_id,
          action,
          entity_type,
          entity_id,
          old_value,
          new_value
        )
      VALUES
        ($1, 'CREATE', 'INSTALLER', $2, NULL, $3)
      `,
      [
        req.user.userId,
        installer.id,
        JSON.stringify({
          name: user.name,
          email: user.email,
          phoneNumber: user.phone_number,
          cityId,
          visitingCharge: Number(visitingCharge || 0),
          doorCharges,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Installer created successfully',
      data: {
        installerId: installer.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phone_number,
        cityId: installer.city_id,
        visitingCharge: installer.visiting_charge,
        doorCharges,
        ...(process.env.NODE_ENV !== 'production'
          ? { activationToken }
          : {}),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Phone number, email, or door charge already exists',
      });
    }

    console.error('Create installer error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create installer',
    });
  } finally {
    client.release();
  }
};

const updateInstaller = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      name,
      email,
      phoneNumber,
      cityId,
      visitingCharge,
      doorCharges,
      isActive,
    } = req.body;

    await client.query('BEGIN');

    // Get current installer details
    const existingResult = await client.query(
      `
      SELECT
        i.id,
        i.user_id,
        i.city_id,
        i.visiting_charge,
        i.is_active,
        u.name,
        u.email,
        u.phone_number
      FROM installers i
      JOIN users u ON u.id = i.user_id
      WHERE i.id = $1
      `,
      [id]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Installer not found',
      });
    }

    const current = existingResult.rows[0];

    const updatedName =
      name !== undefined ? name.trim() : current.name;

    const updatedEmail =
      email !== undefined ? email.trim() || null : current.email;

    const updatedPhone =
      phoneNumber !== undefined
        ? phoneNumber.trim()
        : current.phone_number;

    const updatedCityId =
      cityId !== undefined ? cityId : current.city_id;

    const updatedVisitingCharge =
      visitingCharge !== undefined
        ? Number(visitingCharge)
        : Number(current.visiting_charge);

    const updatedIsActive =
      isActive !== undefined
        ? Boolean(isActive)
        : current.is_active;

    // Validate city
    const cityResult = await client.query(
      `
      SELECT id
      FROM cities
      WHERE id = $1
        AND is_active = TRUE
      `,
      [updatedCityId]
    );

    if (cityResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive city',
      });
    }

    // Update user information
    await client.query(
      `
      UPDATE users
      SET
        name = $1,
        email = $2,
        phone_number = $3,
        is_active = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [
        updatedName,
        updatedEmail,
        updatedPhone,
        updatedIsActive,
        current.user_id,
      ]
    );

    // Update installer information
    await client.query(
      `
      UPDATE installers
      SET
        city_id = $1,
        visiting_charge = $2,
        is_active = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [
        updatedCityId,
        updatedVisitingCharge,
        updatedIsActive,
        id,
      ]
    );

    // Update master door charges only when supplied.
    if (Array.isArray(doorCharges)) {
      for (const charge of doorCharges) {
        await client.query(
          `
          UPDATE installer_door_charges
          SET installation_charge = $1
          WHERE installer_id = $2
            AND door_type_id = $3
          `,
          [
            Number(charge.installationCharge || 0),
            id,
            charge.doorTypeId,
          ]
        );
      }

      await client.query(
        `
        UPDATE installer_door_charges
        SET visiting_charge = $1
        WHERE installer_id = $2
        `,
        [
          updatedVisitingCharge,
          id,
        ]
      );
    }

    // Create one audit record for the complete update
    await client.query(
      `
      INSERT INTO audit_logs
        (
          user_id,
          action,
          entity_type,
          entity_id,
          old_value,
          new_value
        )
      VALUES
        ($1, 'UPDATE', 'INSTALLER', $2, $3, $4)
      `,
      [
        req.user.userId,
        id,
        JSON.stringify({
          name: current.name,
          email: current.email,
          phoneNumber: current.phone_number,
          cityId: current.city_id,
          visitingCharge: current.visiting_charge,
          isActive: current.is_active,
        }),
        JSON.stringify({
          name: updatedName,
          email: updatedEmail,
          phoneNumber: updatedPhone,
          cityId: updatedCityId,
          visitingCharge: updatedVisitingCharge,
          isActive: updatedIsActive,
          doorCharges: doorCharges || null,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Installer updated successfully',
      data: {
        installerId: id,
        userId: current.user_id,
        name: updatedName,
        email: updatedEmail,
        phoneNumber: updatedPhone,
        cityId: updatedCityId,
        visitingCharge: updatedVisitingCharge,
        isActive: updatedIsActive,
        doorCharges: doorCharges || null,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Phone number, email, or door charge already exists',
      });
    }

    console.error('Update installer error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update installer',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getInstallers,
  getInstallerById,
  createInstaller,
  updateInstaller,
};
