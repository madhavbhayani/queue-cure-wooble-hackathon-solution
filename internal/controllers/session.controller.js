const { pool } = require('../database/connection/db.js');
const Hashids = require('hashids/cjs'); // use CommonJS

// Initialize hashids with the env token and exactly 17 characters min length
const hashids = new Hashids(process.env.ENCRYPT_TOKEN || 'fallback_secret', 17);

const startSession = async (req, res) => {
  const clinic_id = req.clinic.clinic_id;

  try {
    // 1. Check if an active session already exists for today
    const checkActive = await pool.query(
      `SELECT id FROM queue_sessions WHERE clinic_id = $1 AND session_date = CURRENT_DATE AND is_active = true`,
      [clinic_id]
    );

    let sessionId;
    if (checkActive.rows.length > 0) {
      // Session already exists, return it
      sessionId = checkActive.rows[0].id;
    } else {
      // 2. Insert new session
      const insertResult = await pool.query(
        `INSERT INTO queue_sessions (clinic_id, session_date, is_active) 
         VALUES ($1, CURRENT_DATE, true) 
         RETURNING id`,
        [clinic_id]
      );
      sessionId = insertResult.rows[0].id;
    }

    // 3. Generate 17-char slug using Hashids
    const slug = hashids.encode(sessionId);

    res.status(200).json({ slug, message: 'Session started successfully' });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getActiveSession = async (req, res) => {
  const clinic_id = req.clinic.clinic_id;

  try {
    const result = await pool.query(
      `SELECT id FROM queue_sessions WHERE clinic_id = $1 AND session_date = CURRENT_DATE AND is_active = true`,
      [clinic_id]
    );

    if (result.rows.length > 0) {
      const sessionId = result.rows[0].id;
      const slug = hashids.encode(sessionId);
      return res.status(200).json({ active: true, slug });
    } else {
      return res.status(200).json({ active: false });
    }
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { startSession, getActiveSession };
