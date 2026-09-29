const path = require('path');
const crypto = require('crypto');

const pool = require('../config/database');

const {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');

const {
  getSignedUrl,
} = require('@aws-sdk/s3-request-presigner');

const {
  s3Client,
  S3_BUCKET,
} = require('../config/s3');


const createSafeFileName = (originalName) => {
  const extension = path.extname(originalName || '').toLowerCase();

  const baseName = path
    .basename(originalName || 'order-form', extension)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);

  const uniqueId = `${Date.now()}-${crypto.randomUUID()}`;

  return `${baseName}-${uniqueId}${extension}`;
};


/**
 * Upload order form
 * POST /admin/jobs/:id/order-file
 */
const uploadOrderFile = async (req, res) => {
  let uploadedKey = null;

  try {
    const { id: jobId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Order form file is required.',
      });
    }

    if (!S3_BUCKET) {
      console.error('AWS_S3_BUCKET is not configured.');

      return res.status(500).json({
        success: false,
        message: 'S3 storage is not configured.',
      });
    }

    // ---------------------------------------------------------
    // 1. Verify job exists
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // 2. Create S3 object key
    // ---------------------------------------------------------

    const safeFileName = createSafeFileName(
      req.file.originalname
    );

    const s3Key = `order-forms/${jobId}/${safeFileName}`;

    uploadedKey = s3Key;

    // ---------------------------------------------------------
    // 3. Upload file to S3
    // ---------------------------------------------------------

    const uploadCommand = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(uploadCommand);

    // ---------------------------------------------------------
    // 4. Store file metadata in PostgreSQL
    // ---------------------------------------------------------

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
        s3Key,
        req.user.userId,
      ]
    );

    // ---------------------------------------------------------
    // 5. Return success
    // ---------------------------------------------------------

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

    // If S3 upload succeeded but DB insertion failed,
    // remove the orphaned S3 object.
    if (uploadedKey && S3_BUCKET) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: uploadedKey,
          })
        );
      } catch (deleteError) {
        console.error(
          'Failed to clean up S3 object:',
          deleteError
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to upload order form.',
    });
  }
};


/**
 * Get order form metadata
 * GET /admin/jobs/:id/order-file
 */
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

    const file = result.rows[0];

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: file.file_url,
      ResponseContentType: file.file_type,
      ResponseContentDisposition: `inline; filename="${file.file_name}"`,
    });

    const signedUrl = await getSignedUrl(
      s3Client,
      command,
      {
        expiresIn: 300,
      }
    );

    return res.json({
      success: true,
      data: {
        ...file,
        file_url: signedUrl,
      },
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