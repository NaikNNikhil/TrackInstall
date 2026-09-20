const pool = require('../config/database');

const getInstallerJobs = async (req, res) => {
  try {
    const installerIdResult = await pool.query(
      `
      SELECT id
      FROM installers
      WHERE user_id = $1
        AND is_active = TRUE
      `,
      [req.user.userId]
    );

    if (installerIdResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Installer profile not found',
      });
    }

    const installerId = installerIdResult.rows[0].id;

    const result = await pool.query(
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
      WHERE j.installer_id = $1
      ORDER BY j.created_at DESC
      `,
      [installerId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get installer jobs error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch installer jobs',
    });
  }
};

const getInstallerJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const installerResult = await pool.query(
      `
      SELECT id
      FROM installers
      WHERE user_id = $1
        AND is_active = TRUE
      `,
      [req.user.userId]
    );

    if (installerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Installer profile not found',
      });
    }

    const installerId = installerResult.rows[0].id;

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
      WHERE j.id = $1
        AND j.installer_id = $2
      `,
      [id, installerId]
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

    const visitsResult = await pool.query(
      `
      SELECT
        v.id,
        v.visit_number,
        v.visit_date,
        v.type,
        v.status,
        vr.name AS reason,
        v.remark,
        v.visiting_charge_snapshot,
        v.created_at
      FROM visits v
      LEFT JOIN visit_reasons vr
        ON vr.id = v.reason_id
      WHERE v.job_id = $1
        AND v.installer_id = $2
      ORDER BY v.visit_number ASC
      `,
      [id, installerId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...jobResult.rows[0],
        doorItems: doorItemsResult.rows,
        visits: visitsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get installer job error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch installer job',
    });
  }
};

const completeInstallerJob = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Find the logged-in installer's profile
    const installerResult = await client.query(
      `
      SELECT id
      FROM installers
      WHERE user_id = $1
        AND is_active = TRUE
      `,
      [req.user.userId]
    );

    if (installerResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Installer profile not found',
      });
    }

    const installerId = installerResult.rows[0].id;

    // Get the job belonging to this installer
    const jobResult = await client.query(
      `
      SELECT
        id,
        order_id,
        status,
        payment_status,
        completed_at
      FROM jobs
      WHERE id = $1
        AND installer_id = $2
      FOR UPDATE
      `,
      [id, installerId]
    );

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const job = jobResult.rows[0];

    // Only ASSIGNED jobs can be completed
    if (job.status !== 'ASSIGNED') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Only assigned jobs can be marked as completed',
      });
    }

    // Check whether an extra visit is waiting for admin approval
    const pendingExtraResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM visits
      WHERE job_id = $1
        AND installer_id = $2
        AND type = 'EXTRA'
        AND status = 'PENDING_APPROVAL'
      `,
      [id, installerId]
    );

    const hasPendingExtraVisit =
      pendingExtraResult.rows[0].count > 0;

    const paymentStatus = hasPendingExtraVisit
      ? 'NOT_READY'
      : 'PAYMENT_PENDING';

    // Complete the job
    const updatedResult = await client.query(
      `
      UPDATE jobs
      SET
        status = 'COMPLETED',
        payment_status = $1,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        order_id,
        status,
        payment_status,
        completed_at,
        updated_at
      `,
      [paymentStatus, id]
    );

    const updatedJob = updatedResult.rows[0];

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
          'COMPLETE',
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
          status: job.status,
          paymentStatus: job.payment_status,
          completedAt: job.completed_at,
        }),
        JSON.stringify({
          status: updatedJob.status,
          paymentStatus: updatedJob.payment_status,
          completedAt: updatedJob.completed_at,
          pendingExtraVisit: hasPendingExtraVisit,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Installation marked as completed',
      data: {
        ...updatedJob,
        pendingExtraVisit: hasPendingExtraVisit,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Complete installer job error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to complete installation',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getInstallerJobs,
  getInstallerJobById,
  completeInstallerJob
};