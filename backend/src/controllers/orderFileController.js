const pool = require('../config/database');

const uploadOrderFile = async (req, res) => {
  try {
    const { id: jobId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Order form file is required.',
      });
    }

    const jobResult = await pool.query(
      `
      SELECT id
      FROM jobs
      WHERE id = $1
      `,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.',
      });
    }

    const fileUrl =
      `/uploads/order-forms/${req.file.filename}`;

    const result = await pool.query(
      `
      INSERT INTO order_files
        (
          job_id,
          file_name,
          file_type,
          file_url,
          uploaded_by
        )
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING
        id,
        job_id,
        file_name,
        file_type,
        file_url,
        uploaded_by,
        created_at
      `,
      [
        jobId,
        req.file.originalname,
        req.file.mimetype,
        fileUrl,
        req.user.userId,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Order form uploaded successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'uploadOrderFile error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to upload order form.',
    });
  }
};

const getOrderFile = async (req, res) => {
  try {
    const { id: jobId } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        job_id,
        file_name,
        file_type,
        file_url,
        uploaded_by,
        created_at
      FROM order_files
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No order form found for this job.',
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      'getOrderFile error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order form.',
    });
  }
};

module.exports = {
  uploadOrderFile,
  getOrderFile,
};