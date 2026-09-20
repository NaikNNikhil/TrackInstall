const pool = require('../config/database');

const createInstallerVisit = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id: jobId } = req.params;

    const {
      visitDate,
      reasonId,
      remark,
    } = req.body;

    if (!visitDate) {
      return res.status(400).json({
        success: false,
        message: 'visitDate is required',
      });
    }

    await client.query('BEGIN');

    // Find logged-in installer's profile
    const installerResult = await client.query(
      `
      SELECT
        id,
        visiting_charge
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

    const installer = installerResult.rows[0];

    // Verify that the job belongs to this installer
    const jobResult = await client.query(
      `
        SELECT
          id,
          expected_visits,
          status,
          payment_status,
          installer_id,
          visiting_charge_snapshot
        FROM jobs
        WHERE id = $1
          AND installer_id = $2
        FOR UPDATE
      `,
      [jobId, installer.id]
    );

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const job = jobResult.rows[0];

    // Visits cannot be created after payment
    if (job.status === 'PAID') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Visits cannot be added after payment',
      });
    }

    // Determine next visit number
    const visitNumberResult = await client.query(
      `
      SELECT COALESCE(MAX(visit_number), 0) + 1 AS visit_number
      FROM visits
      WHERE job_id = $1
      `,
      [jobId]
    );

    const visitNumber = Number(
      visitNumberResult.rows[0].visit_number
    );

    const type =
      visitNumber <= Number(job.expected_visits)
        ? 'NORMAL'
        : 'EXTRA';
    
    const visitStatus =
      type === 'EXTRA'
        ? 'PENDING_APPROVAL'
        : 'COMPLETED';

    if (type === 'EXTRA' && !reasonId) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Reason is required for an extra visit',
      });
    }

    // Validate reason for extra visit
    if (type === 'EXTRA') {
      const reasonResult = await client.query(
        `
        SELECT id
        FROM visit_reasons
        WHERE id = $1
          AND is_active = TRUE
        `,
        [reasonId]
      );

      if (reasonResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive visit reason',
        });
      }
    }

    /*
     * IMPORTANT:
     * The visit charge is taken from the job snapshot,
     * not the installer's current master rate.
     */
    const visitingChargeSnapshot =
      Number(job.visiting_charge_snapshot);

    const visitResult = await client.query(
      `
      INSERT INTO visits
        (
          job_id,
          installer_id,
          visit_number,
          visit_date,
          type,
          status,
          reason_id,
          remark,
          visiting_charge_snapshot
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
          $8,
          $9
        )
      RETURNING
        id,
        job_id,
        installer_id,
        visit_number,
        visit_date,
        type,
        status,
        reason_id,
        remark,
        visiting_charge_snapshot,
        created_at
      `,
      [
        jobId,
        installer.id,
        visitNumber,
        visitDate,
        type,
        visitStatus,
        type === 'EXTRA' ? reasonId : null,
        remark?.trim() || null,
        visitingChargeSnapshot,
      ]
    );

    const visit = visitResult.rows[0];

    /*
     * If an extra visit is requested, payment cannot
     * become ready until Admin resolves it.
     *
     * If the job is already COMPLETED, keep the job
     * COMPLETED but move payment back to NOT_READY.
     */
    if (type === 'EXTRA' && job.status === 'COMPLETED') {
      await client.query(
        `
        UPDATE jobs
        SET
          payment_status = 'NOT_READY',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [jobId]
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
          'VISIT',
          $2,
          NULL,
          $3
        )
      `,
      [
        req.user.userId,
        visit.id,
        JSON.stringify({
          jobId,
          installerId: installer.id,
          visitNumber,
          visitDate,
          type,
          status: visitStatus,
          reasonId:
            type === 'EXTRA' ? reasonId : null,
          remark: remark?.trim() || null,
          visitingChargeSnapshot,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message:
        type === 'EXTRA'
          ? 'Extra visit requested successfully'
          : 'Visit recorded successfully',
      data: visit,
    });
  } catch (error) {
  await client.query('ROLLBACK');

  console.error('Create installer visit error:', error);

  return res.status(500).json({
    success: false,
    message: error.message,
    error: error.detail || null,
  });
  } finally {
    client.release();
  }
};

const getInstallerVisits = async (req, res) => {
  try {
    const { id: jobId } = req.params;

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
        id,
        expected_visits,
        status,
        payment_status,
        visiting_charge_snapshot
      FROM jobs
      WHERE id = $1
        AND installer_id = $2
      `,
      [jobId, installerId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const result = await pool.query(
      `
      SELECT
        v.id,
        v.job_id,
        v.visit_number,
        v.visit_date,
        v.type,
        v.status,
        v.reason_id,
        vr.name AS reason,
        v.remark,
        v.visiting_charge_snapshot,
        v.created_at,
        v.updated_at
      FROM visits v
      LEFT JOIN visit_reasons vr
        ON vr.id = v.reason_id
      WHERE v.job_id = $1
        AND v.installer_id = $2
      ORDER BY v.visit_number ASC
      `,
      [jobId, installerId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get installer visits error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch visits',
    });
  }
};

module.exports = {
  createInstallerVisit,
  getInstallerVisits,
};