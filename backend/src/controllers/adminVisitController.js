const pool = require('../config/database');

const getAdminVisits = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id,
        v.job_id,
        v.installer_id,
        v.visit_number,
        v.visit_date,
        v.type,
        v.status,
        v.remark,
        v.visiting_charge_snapshot,
        vr.name AS reason,
        j.order_id,
        j.site_name,
        j.customer_name,
        u.name AS installer_name
      FROM visits v
      JOIN jobs j ON j.id = v.job_id
      JOIN installers i ON i.id = v.installer_id
      JOIN users u ON u.id = i.user_id
      LEFT JOIN visit_reasons vr ON vr.id = v.reason_id
      ORDER BY v.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get admin visits error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch visits',
    });
  }
};

const getPendingVisitApprovals = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id,
        v.job_id,
        v.installer_id,
        v.visit_number,
        v.visit_date,
        v.type,
        v.status,
        v.remark,
        v.visiting_charge_snapshot,
        vr.name AS reason,
        j.order_id,
        j.site_name,
        j.customer_name,
        u.name AS installer_name
      FROM visits v
      JOIN jobs j ON j.id = v.job_id
      JOIN installers i ON i.id = v.installer_id
      JOIN users u ON u.id = i.user_id
      LEFT JOIN visit_reasons vr ON vr.id = v.reason_id
      WHERE v.status = 'PENDING_APPROVAL'
      ORDER BY v.created_at ASC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get pending visit approvals error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending visit approvals',
    });
  }
};

const updateVisitApproval = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be APPROVED or REJECTED',
      });
    }

    await client.query('BEGIN');

    const visitResult = await client.query(
      `
      SELECT
        v.*,
        j.status AS job_status,
        j.payment_status AS job_payment_status,
        j.order_id
      FROM visits v
      JOIN jobs j ON j.id = v.job_id
      WHERE v.id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (visitResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Visit not found',
      });
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'PENDING_APPROVAL') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Only pending extra visits can be approved or rejected',
      });
    }

    if (visit.type !== 'EXTRA') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Only extra visits require approval',
      });
    }

    if (visit.job_status === 'PAID') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Cannot modify a visit for a paid job',
      });
    }

    const updatedVisitResult = await client.query(
      `
      UPDATE visits
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    const pendingResult = await client.query(
      `
      SELECT COUNT(*) AS count
      FROM visits
      WHERE job_id = $1
        AND type = 'EXTRA'
        AND status = 'PENDING_APPROVAL'
      `,
      [visit.job_id]
    );

    const pendingCount = Number(pendingResult.rows[0].count);

    let newPaymentStatus = visit.job_payment_status;

    if (visit.job_status === 'COMPLETED' && pendingCount === 0) {
      newPaymentStatus = 'PAYMENT_PENDING';

      await client.query(
        `
        UPDATE jobs
        SET payment_status = 'PAYMENT_PENDING',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND status = 'COMPLETED'
        `,
        [visit.job_id]
      );
    }

    await client.query(
      `
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        req.user.userId,
        status === 'APPROVED' ? 'APPROVE_VISIT' : 'REJECT_VISIT',
        'VISIT',
        id,
        JSON.stringify({
          status: visit.status,
        }),
        JSON.stringify({
          status,
          paymentStatus: newPaymentStatus,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message:
        status === 'APPROVED'
          ? 'Extra visit approved successfully'
          : 'Extra visit rejected successfully',
      data: {
        visit: updatedVisitResult.rows[0],
        paymentStatus: newPaymentStatus,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Update visit approval error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update visit approval',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getAdminVisits,
  getPendingVisitApprovals,
  updateVisitApproval,
};