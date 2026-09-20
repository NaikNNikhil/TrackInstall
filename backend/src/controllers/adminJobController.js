const pool = require('../config/database');

const createJob = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      orderId,
      siteName,
      customerName,
      contactNumber,
      address,
      cityId,
      installerId,
      expectedVisits = 0,
      doorItems,
    } = req.body;

    if (
      !orderId ||
      !siteName ||
      !customerName ||
      !contactNumber ||
      !address ||
      !cityId ||
      !installerId
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Order ID, site name, customer name, contact number, address, city and installer are required',
      });
    }

    if (!Array.isArray(doorItems) || doorItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one door item is required',
      });
    }

    if (Number(expectedVisits) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Expected visits cannot be negative',
      });
    }

    await client.query('BEGIN');

    // Validate city
    const cityResult = await client.query(
      `
      SELECT id, name
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

    // Get installer and current master visiting charge
    const installerResult = await client.query(
      `
      SELECT
        i.id,
        i.city_id,
        i.visiting_charge,
        i.is_active,
        u.name AS installer_name
      FROM installers i
      JOIN users u ON u.id = i.user_id
      WHERE i.id = $1
      `,
      [installerId]
    );

    if (installerResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Installer not found',
      });
    }

    const installer = installerResult.rows[0];

    if (!installer.is_active) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Installer is inactive',
      });
    }

    if (installer.city_id !== cityId) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Installer does not belong to the selected city',
      });
    }

    // Prevent duplicate order IDs
    const existingOrder = await client.query(
      `
      SELECT id
      FROM jobs
      WHERE order_id = $1
      `,
      [orderId.trim()]
    );

    if (existingOrder.rows.length > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        success: false,
        message: 'Order ID already exists',
      });
    }

    /*
     * Validate and snapshot every door item.
     * Charges are read from the installer's current master rates.
     */
    const snapshotItems = [];

    for (const item of doorItems) {
      if (!item.doorTypeId || Number(item.quantity) <= 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message:
            'Each door item must have a valid door type and quantity greater than 0',
        });
      }

      const chargeResult = await client.query(
        `
        SELECT
          idc.door_type_id,
          dt.name AS door_type,
          idc.installation_charge
        FROM installer_door_charges idc
        JOIN door_types dt
          ON dt.id = idc.door_type_id
        WHERE idc.installer_id = $1
          AND idc.door_type_id = $2
        `,
        [installerId, item.doorTypeId]
      );

      if (chargeResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message:
            `No installation charge configured for door type ${item.doorTypeId}`,
        });
      }

      const charge = chargeResult.rows[0];

      snapshotItems.push({
        doorTypeId: charge.door_type_id,
        doorType: charge.door_type,
        quantity: Number(item.quantity),
        installationCharge: Number(charge.installation_charge),
      });
    }

    // Create job
    const jobResult = await client.query(
      `
      INSERT INTO jobs
        (
          order_id,
          site_name,
          customer_name,
          contact_number,
          address,
          city_id,
          installer_id,
          status,
          payment_status,
          visiting_charge_snapshot,
          expected_visits,
          assigned_at
        )
      VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'ASSIGNED',
          'NOT_READY',
          $8,
          $9,
          CURRENT_TIMESTAMP
        )
      RETURNING
        id,
        order_id,
        site_name,
        customer_name,
        contact_number,
        address,
        city_id,
        installer_id,
        status,
        payment_status,
        visiting_charge_snapshot,
        expected_visits,
        assigned_at,
        created_at,
        updated_at
      `,
      [
        orderId.trim(),
        siteName.trim(),
        customerName.trim(),
        contactNumber.trim(),
        address.trim(),
        cityId,
        installerId,
        Number(installer.visiting_charge),
        Number(expectedVisits),
      ]
    );

    const job = jobResult.rows[0];

    // Create door item snapshots
    for (const item of snapshotItems) {
      await client.query(
        `
        INSERT INTO job_door_items
          (
            job_id,
            door_type_id,
            quantity,
            installation_charge_snapshot
          )
        VALUES
          ($1, $2, $3, $4)
        `,
        [
          job.id,
          item.doorTypeId,
          item.quantity,
          item.installationCharge,
        ]
      );
    }

    // Audit log
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
        (
          $1,
          'CREATE',
          'JOB',
          $2,
          NULL,
          $3
        )
      `,
      [
        req.user.userId,
        job.id,
        JSON.stringify({
          orderId: job.order_id,
          siteName: job.site_name,
          customerName: job.customer_name,
          contactNumber: job.contact_number,
          address: job.address,
          cityId: job.city_id,
          installerId: job.installer_id,
          status: job.status,
          paymentStatus: job.payment_status,
          visitingChargeSnapshot:
            job.visiting_charge_snapshot,
          expectedVisits: job.expected_visits,
          doorItems: snapshotItems,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Job assigned successfully',
      data: {
        ...job,
        doorItems: snapshotItems,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Order ID already exists',
      });
    }

    console.error('Create job error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to assign job',
    });
  } finally {
    client.release();
  }
};

const getJobs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        j.id,
        j.order_id,
        j.site_name,
        j.customer_name,
        j.contact_number,
        j.address,
        j.city_id,
        c.name AS city_name,
        j.installer_id,
        u.name AS installer_name,
        j.status,
        j.payment_status,
        j.visiting_charge_snapshot,
        j.expected_visits,
        j.assigned_at,
        j.completed_at,
        j.created_at,
        j.updated_at
      FROM jobs j
      JOIN cities c ON c.id = j.city_id
      JOIN installers i ON i.id = j.installer_id
      JOIN users u ON u.id = i.user_id
      ORDER BY j.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get jobs error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
    });
  }
};

const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const jobResult = await pool.query(
      `
      SELECT
        j.id,
        j.order_id,
        j.site_name,
        j.customer_name,
        j.contact_number,
        j.address,
        j.city_id,
        c.name AS city_name,
        j.installer_id,
        u.name AS installer_name,
        u.phone_number AS installer_phone,
        j.status,
        j.payment_status,
        j.visiting_charge_snapshot,
        j.expected_visits,
        j.assigned_at,
        j.completed_at,
        j.created_at,
        j.updated_at
      FROM jobs j
      JOIN cities c ON c.id = j.city_id
      JOIN installers i ON i.id = j.installer_id
      JOIN users u ON u.id = i.user_id
      WHERE j.id = $1
      `,
      [id]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const doorItemsResult = await pool.query(
      `
      SELECT
        jdi.id,
        jdi.door_type_id,
        dt.name AS door_type,
        jdi.quantity,
        jdi.installation_charge_snapshot
      FROM job_door_items jdi
      JOIN door_types dt
        ON dt.id = jdi.door_type_id
      WHERE jdi.job_id = $1
      ORDER BY dt.name
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...jobResult.rows[0],
        doorItems: doorItemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get job error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch job',
    });
  }
};

const updateJob = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      siteName,
      customerName,
      contactNumber,
      address,
      cityId,
      installerId,
      expectedVisits,
      visitingChargeSnapshot,
      doorItems,
    } = req.body;

    await client.query('BEGIN');

    // Get existing job
    const existingResult = await client.query(
      `
      SELECT
        id,
        order_id,
        site_name,
        customer_name,
        contact_number,
        address,
        city_id,
        installer_id,
        status,
        payment_status,
        visiting_charge_snapshot,
        expected_visits
      FROM jobs
      WHERE id = $1
      `,
      [id]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const current = existingResult.rows[0];

    // Only ASSIGNED jobs can be edited
    if (current.status !== 'ASSIGNED') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Only assigned jobs can be edited',
      });
    }

    const updatedSiteName =
      siteName !== undefined ? siteName.trim() : current.site_name;

    const updatedCustomerName =
      customerName !== undefined
        ? customerName.trim()
        : current.customer_name;

    const updatedContactNumber =
      contactNumber !== undefined
        ? contactNumber.trim()
        : current.contact_number;

    const updatedAddress =
      address !== undefined ? address.trim() : current.address;

    const updatedCityId =
      cityId !== undefined ? cityId : current.city_id;

    const updatedInstallerId =
      installerId !== undefined
        ? installerId
        : current.installer_id;

    const updatedExpectedVisits =
      expectedVisits !== undefined
        ? Number(expectedVisits)
        : current.expected_visits;

    const updatedVisitingCharge =
      visitingChargeSnapshot !== undefined
        ? Number(visitingChargeSnapshot)
        : Number(current.visiting_charge_snapshot);

    if (updatedExpectedVisits < 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Expected visits cannot be negative',
      });
    }

    if (updatedVisitingCharge < 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Visiting charge cannot be negative',
      });
    }

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

    // Validate installer
    const installerResult = await client.query(
      `
      SELECT
        i.id,
        i.city_id,
        i.is_active
      FROM installers i
      WHERE i.id = $1
      `,
      [updatedInstallerId]
    );

    if (installerResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Installer not found',
      });
    }

    const installer = installerResult.rows[0];

    if (!installer.is_active) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Installer is inactive',
      });
    }

    if (installer.city_id !== updatedCityId) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Installer does not belong to the selected city',
      });
    }

    // Update job
    const jobResult = await client.query(
      `
      UPDATE jobs
      SET
        site_name = $1,
        customer_name = $2,
        contact_number = $3,
        address = $4,
        city_id = $5,
        installer_id = $6,
        visiting_charge_snapshot = $7,
        expected_visits = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING
        id,
        order_id,
        site_name,
        customer_name,
        contact_number,
        address,
        city_id,
        installer_id,
        status,
        payment_status,
        visiting_charge_snapshot,
        expected_visits,
        assigned_at,
        completed_at,
        created_at,
        updated_at
      `,
      [
        updatedSiteName,
        updatedCustomerName,
        updatedContactNumber,
        updatedAddress,
        updatedCityId,
        updatedInstallerId,
        updatedVisitingCharge,
        updatedExpectedVisits,
        id,
      ]
    );

    const job = jobResult.rows[0];

    /*
     * Door prices are snapshots.
     * They are changed only when Admin explicitly
     * sends doorItems in the update request.
     */
    if (Array.isArray(doorItems)) {
      if (doorItems.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'At least one door item is required',
        });
      }

      await client.query(
        `
        DELETE FROM job_door_items
        WHERE job_id = $1
        `,
        [id]
      );

      for (const item of doorItems) {
        if (
          !item.doorTypeId ||
          Number(item.quantity) <= 0 ||
          Number(item.installationCharge) < 0
        ) {
          await client.query('ROLLBACK');

          return res.status(400).json({
            success: false,
            message:
              'Each door item must have a valid door type, quantity and installation charge',
          });
        }

        const doorTypeResult = await client.query(
          `
          SELECT id
          FROM door_types
          WHERE id = $1
            AND is_active = TRUE
          `,
          [item.doorTypeId]
        );

        if (doorTypeResult.rows.length === 0) {
          await client.query('ROLLBACK');

          return res.status(400).json({
            success: false,
            message: `Invalid door type: ${item.doorTypeId}`,
          });
        }

        await client.query(
          `
          INSERT INTO job_door_items
            (
              job_id,
              door_type_id,
              quantity,
              installation_charge_snapshot
            )
          VALUES
            ($1, $2, $3, $4)
          `,
          [
            id,
            item.doorTypeId,
            Number(item.quantity),
            Number(item.installationCharge),
          ]
        );
      }
    }

    // Get final door items for response/audit
    const doorItemsResult = await client.query(
      `
      SELECT
        jdi.door_type_id,
        dt.name AS door_type,
        jdi.quantity,
        jdi.installation_charge_snapshot
      FROM job_door_items jdi
      JOIN door_types dt
        ON dt.id = jdi.door_type_id
      WHERE jdi.job_id = $1
      ORDER BY dt.name
      `,
      [id]
    );

    // Audit one complete update action
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
        (
          $1,
          'UPDATE',
          'JOB',
          $2,
          $3,
          $4
        )
      `,
      [
        req.user.userId,
        id,
        JSON.stringify({
          siteName: current.site_name,
          customerName: current.customer_name,
          contactNumber: current.contact_number,
          address: current.address,
          cityId: current.city_id,
          installerId: current.installer_id,
          visitingChargeSnapshot:
            current.visiting_charge_snapshot,
          expectedVisits: current.expected_visits,
        }),
        JSON.stringify({
          siteName: updatedSiteName,
          customerName: updatedCustomerName,
          contactNumber: updatedContactNumber,
          address: updatedAddress,
          cityId: updatedCityId,
          installerId: updatedInstallerId,
          visitingChargeSnapshot: updatedVisitingCharge,
          expectedVisits: updatedExpectedVisits,
          doorItems: doorItems || null,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: {
        ...job,
        doorItems: doorItemsResult.rows,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Update job error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update job',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createJob,
  getJobs,
  getJobById,
  updateJob,
};