const pool = require('../config/database');

const calculateJobPayment = async (client, jobId) => {
  const jobResult = await client.query(
    `
    SELECT
      id,
      order_id,
      site_name,
      status,
      payment_status
    FROM jobs
    WHERE id = $1
    `,
    [jobId]
  );

  if (jobResult.rows.length === 0) {
    return null;
  }

  const job = jobResult.rows[0];

  const installationResult = await client.query(
    `
    SELECT COALESCE(
      SUM(quantity * installation_charge_snapshot),
      0
    ) AS amount
    FROM job_door_items
    WHERE job_id = $1
    `,
    [jobId]
  );

  const normalVisitResult = await client.query(
    `
    SELECT COALESCE(
      SUM(visiting_charge_snapshot),
      0
    ) AS amount
    FROM visits
    WHERE job_id = $1
      AND type = 'NORMAL'
      AND status = 'COMPLETED'
    `,
    [jobId]
  );

  const extraVisitResult = await client.query(
    `
    SELECT COALESCE(
      SUM(visiting_charge_snapshot),
      0
    ) AS amount
    FROM visits
    WHERE job_id = $1
      AND type = 'EXTRA'
      AND status = 'APPROVED'
    `,
    [jobId]
  );

  const installationAmount = Number(
    installationResult.rows[0].amount
  );

  const normalVisitAmount = Number(
    normalVisitResult.rows[0].amount
  );

  const extraVisitAmount = Number(
    extraVisitResult.rows[0].amount
  );

  const totalAmount =
    installationAmount +
    normalVisitAmount +
    extraVisitAmount;

  return {
    job,
    installationAmount,
    normalVisitAmount,
    extraVisitAmount,
    totalAmount,
  };
};

const getPayments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        j.id AS job_id,
        j.order_id,
        j.site_name,
        j.status AS job_status,
        j.payment_status,
        p.id AS payment_id,
        p.status AS payment_record_status,
        p.paid_at
      FROM jobs j
      LEFT JOIN payments p
        ON p.job_id = j.id
      WHERE j.payment_status IN ('PAYMENT_PENDING', 'PAID')
      ORDER BY
        CASE
          WHEN j.payment_status = 'PAYMENT_PENDING' THEN 0
          ELSE 1
        END,
        j.created_at DESC
    `);

    const payments = [];

    for (const row of result.rows) {
      const calculation = await calculateJobPayment(
        pool,
        row.job_id
      );

      payments.push({
        id: row.payment_id || `job-${row.job_id}`,
        job_id: row.job_id,
        order_id: row.order_id,
        site_name: row.site_name,
        job_status: row.job_status,
        payment_status: row.payment_status,

        installation_amount: calculation.installationAmount,
        normal_visit_amount: calculation.normalVisitAmount,
        extra_visit_amount: calculation.extraVisitAmount,
        total_amount: calculation.totalAmount,

        status:
          row.payment_record_status ||
          (row.payment_status === 'PAID' ? 'PAID' : 'PENDING'),

        paid_at: row.paid_at || null,
      });
    }

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error('getPayments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load payments',
    });
  }
};

const getJobPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const { jobId } = req.params;

    const payment = await calculateJobPayment(client, jobId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error('Get job payment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to calculate payment',
    });
  } finally {
    client.release();
  }
};

const markPaymentPaid = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const jobResult = await client.query(
      `
      SELECT
        id,
        order_id,
        site_name,
        status,
        payment_status
      FROM jobs
      WHERE id = $1
      FOR UPDATE
      `,
      [req.params.jobId]
    );

    if (!jobResult.rows.length) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const job = jobResult.rows[0];

    if (job.status !== 'COMPLETED') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Only completed jobs can be marked as paid',
      });
    }

    if (job.payment_status !== 'PAYMENT_PENDING') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Payment is not pending for this job',
      });
    }

    const calculation = await calculateJobPayment(
      client,
      job.id
    );

    const existingPayment = await client.query(
      `
      SELECT id, status
      FROM payments
      WHERE job_id = $1
      LIMIT 1
      `,
      [job.id]
    );

    let payment;

    if (existingPayment.rows.length) {
      const existing = existingPayment.rows[0];

      if (existing.status === 'PAID') {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'Payment is already marked as paid',
        });
      }

      const updateResult = await client.query(
        `
        UPDATE payments
        SET
          installation_amount = $1,
          normal_visit_amount = $2,
          extra_visit_amount = $3,
          total_amount = $4,
          status = 'PAID',
          paid_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
        `,
        [
          calculation.installationAmount,
          calculation.normalVisitAmount,
          calculation.extraVisitAmount,
          calculation.totalAmount,
          existing.id,
        ]
      );

      payment = updateResult.rows[0];
    } else {
      const insertResult = await client.query(
        `
        INSERT INTO payments (
          job_id,
          installation_amount,
          normal_visit_amount,
          extra_visit_amount,
          total_amount,
          status,
          paid_at
        )
        VALUES ($1, $2, $3, $4, $5, 'PAID', CURRENT_TIMESTAMP)
        RETURNING *
        `,
        [
          job.id,
          calculation.installationAmount,
          calculation.normalVisitAmount,
          calculation.extraVisitAmount,
          calculation.totalAmount,
        ]
      );

      payment = insertResult.rows[0];
    }

    await client.query(
      `
      UPDATE jobs
      SET
        status = 'PAID',
        payment_status = 'PAID',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [job.id]
    );

    await client.query(
      `
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id
      )
      VALUES ($1, $2, $3, $4)
      `,
      [
        req.user.userId,
        'MARK_PAYMENT_PAID',
        'JOB',
        job.id,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Payment marked as paid successfully',
      data: payment,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('markPaymentPaid error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to mark payment as paid',
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getPayments,
  getJobPayment,
  markPaymentPaid,
};