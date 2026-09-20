const pool = require('../config/database');

const getCities = async (req, res) => {
    try {
        const result = await pool.query(
            `
      SELECT
        id,
        name,
        is_active,
        created_at,
        updated_at
      FROM cities
      ORDER BY name ASC
      `
        );

        return res.status(200).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('Get cities error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch cities',
        });
    }
};

const getCityById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
      SELECT
        id,
        name,
        is_active,
        created_at,
        updated_at
      FROM cities
      WHERE id = $1
      `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'City not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Get city error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch city',
        });
    }
};

const createCity = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'City name is required',
            });
        }

        const result = await pool.query(
            `
      INSERT INTO cities (name)
      VALUES ($1)
      RETURNING
        id,
        name,
        is_active,
        created_at,
        updated_at
      `,
            [name.trim()]
        );

        return res.status(201).json({
            success: true,
            message: 'City created successfully',
            data: result.rows[0],
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'City already exists',
            });
        }

        console.error('Create city error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create city',
        });
    }
};

const updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, is_active } = req.body;

        if (name !== undefined && !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'City name cannot be empty',
            });
        }

        const existing = await pool.query(
            `
      SELECT id, name, is_active
      FROM cities
      WHERE id = $1
      `,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'City not found',
            });
        }

        const current = existing.rows[0];

        const updatedName =
            name !== undefined ? name.trim() : current.name;

        const updatedActive =
            is_active !== undefined
                ? Boolean(is_active)
                : current.is_active;

        const result = await pool.query(
            `
            UPDATE cities
            SET
                name = $1,
                is_active = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING
                id,
                name,
                is_active,
                created_at,
                updated_at
            `,
            [updatedName, updatedActive, id]
        );

        return res.status(200).json({
            success: true,
            message: 'City updated successfully',
            data: result.rows[0],
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'City already exists',
            });
        }

        console.error('Update city error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update city',
        });
    }
};

module.exports = {
    getCities,
    getCityById,
    createCity,
    updateCity,
};