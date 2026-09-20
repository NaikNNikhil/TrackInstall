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
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        p.id,
        p.job_id,
        p.installation_amount,
        p.normal_visit_amount,
        p.extra_visit_amount,
        p.total_amount,
        p.status,
        p.paid_at,
        j.order_id,
        j.site_name,
        j.status AS job_status,
        j.payment_status
      FROM payments p
      JOIN jobs j ON j.id = p.job_id
      ORDER BY p.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get payments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
    });
  } finally {
    client.release();
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

const createPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const { jobId } = req.params;

    await client.query('BEGIN');

    const payment = await calculateJobPayment(client, jobId);

    if (!payment) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (payment.job.status === 'PAID') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Job has already been paid',
      });
    }

    if (payment.job.status !== 'COMPLETED') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Payment can only be created after job completion',
      });
    }

    if (payment.job.payment_status !== 'PAYMENT_PENDING') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Payment is not ready for this job',
      });
    }

    const existingPayment = await client.query(
      `
      SELECT id
      FROM payments
      WHERE job_id = $1
      `,
      [jobId]
    );

    if (existingPayment.rows.length > 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Payment record already exists',
      });
    }

    const paymentResult = await client.query(
      `
      INSERT INTO payments (
        job_id,
        installation_amount,
        normal_visit_amount,
        extra_visit_amount,
        total_amount,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING *
      `,
      [
        jobId,
        payment.installationAmount,
        payment.normalVisitAmount,
        payment.extraVisitAmount,
        payment.totalAmount,
      ]
    );

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
        'CREATE_PAYMENT',
        'PAYMENT',
        paymentResult.rows[0].id,
        null,
        JSON.stringify(paymentResult.rows[0]),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Payment record created successfully',
      data: paymentResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Create payment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create payment',
    });
  } finally {
    client.release();
  }
};

const markPaymentPaid = async (req, res) => {
  const client = await pool.connect();

  try {
    const { jobId } = req.params;

    await client.query('BEGIN');

    const jobResult = await client.query(
      `
      SELECT
        id,
        status,
        payment_status
      FROM jobs
      WHERE id = $1
      FOR UPDATE
      `,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const job = jobResult.rows[0];

    if (job.payment_status !== 'PAYMENT_PENDING') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Job payment is not pending',
      });
    }

    const paymentResult = await client.query(
      `
      SELECT *
      FROM payments
      WHERE job_id = $1
      FOR UPDATE
      `,
      [jobId]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Payment record not found. Create the payment first.',
      });
    }

    const payment = paymentResult.rows[0];

    if (payment.status === 'PAID') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Payment is already marked as paid',
      });
    }

    const updatedPaymentResult = await client.query(
      `
      UPDATE payments
      SET
        status = 'PAID',
        paid_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [payment.id]
    );

    await client.query(
      `
      UPDATE jobs
      SET
        status = 'PAID',
        payment_status = 'PAID',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [jobId]
    );

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
        'MARK_PAYMENT_PAID',
        'PAYMENT',
        payment.id,
        JSON.stringify({
          paymentStatus: job.payment_status,
          jobStatus: job.status,
          paymentRecordStatus: payment.status,
        }),
        JSON.stringify({
          paymentStatus: 'PAID',
          jobStatus: 'PAID',
          paymentRecordStatus: 'PAID',
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Payment marked as paid successfully',
      data: updatedPaymentResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Mark payment paid error:', error);

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
  createPayment,
  markPaymentPaid,
};