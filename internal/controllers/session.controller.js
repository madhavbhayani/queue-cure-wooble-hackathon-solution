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

const getAllSessions = async (req, res) => {
  const clinic_id = req.clinic.clinic_id;
  const { search, minPatients, maxPatients, minAvgTime, maxAvgTime } = req.query;

  try {
    let query = `
      SELECT id, session_date, is_active, opened_at, closed_at, total_tokens_issued, total_tokens_done, avg_consult_secs 
      FROM queue_sessions 
      WHERE clinic_id = $1
    `;
    const params = [clinic_id];
    let paramIndex = 2;

    if (search) {
      if (search.includes('/')) {
        const parts = search.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        
        if (!isNaN(day)) {
          query += ` AND EXTRACT(DAY FROM session_date) = $${paramIndex}`;
          params.push(day);
          paramIndex++;
        }
        if (!isNaN(month)) {
          query += ` AND EXTRACT(MONTH FROM session_date) = $${paramIndex}`;
          params.push(month);
          paramIndex++;
        }
        
        if (parts.length >= 3) {
          let year = parseInt(parts[2], 10);
          if (!isNaN(year)) {
            if (parts[2].length === 2) {
              year = 2000 + year; // Convert "24" to 2024
            }
            query += ` AND EXTRACT(YEAR FROM session_date) = $${paramIndex}`;
            params.push(year);
            paramIndex++;
          }
        }
      } else {
        const searchNum = parseInt(search, 10);
        if (!isNaN(searchNum) && search.match(/^\d+$/)) {
          if (search.length === 4) {
            // It's a year
            query += ` AND EXTRACT(YEAR FROM session_date) = $${paramIndex}`;
            params.push(searchNum);
            paramIndex++;
          } else if (searchNum >= 1 && searchNum <= 31) {
            // It's a day
            query += ` AND EXTRACT(DAY FROM session_date) = $${paramIndex}`;
            params.push(searchNum);
            paramIndex++;
          }
        } else {
          // It's a string (likely month)
          query += ` AND to_char(session_date, 'FMMonth') ILIKE $${paramIndex}`;
          params.push(`%${search}%`);
          paramIndex++;
        }
      }
    }

    if (minPatients) {
      query += ` AND total_tokens_done >= $${paramIndex}`;
      params.push(parseInt(minPatients, 10));
      paramIndex++;
    }
    if (maxPatients) {
      query += ` AND total_tokens_done <= $${paramIndex}`;
      params.push(parseInt(maxPatients, 10));
      paramIndex++;
    }
    if (minAvgTime) {
      query += ` AND avg_consult_secs >= $${paramIndex}`;
      params.push(parseInt(minAvgTime, 10));
      paramIndex++;
    }
    if (maxAvgTime) {
      query += ` AND avg_consult_secs <= $${paramIndex}`;
      params.push(parseInt(maxAvgTime, 10));
      paramIndex++;
    }

    query += ` ORDER BY session_date DESC`;

    const result = await pool.query(query, params);

    const sessions = result.rows.map(row => ({
      ...row,
      slug: hashids.encode(row.id)
    }));

    res.status(200).json(sessions);
  } catch (error) {
    console.error('Error fetching all sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const endSession = async (req, res) => {
  const clinic_id = req.clinic.clinic_id;
  const { slug } = req.params;

  try {
    const decoded = hashids.decode(slug);
    if (!decoded || decoded.length === 0) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const sessionId = decoded[0];

    await pool.query(
      `UPDATE queue_sessions 
       SET is_active = false, closed_at = now() 
       WHERE id = $1 AND clinic_id = $2 AND is_active = true`,
      [sessionId, clinic_id]
    );

    res.status(200).json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSessionDetails = async (req, res) => {
  const clinic_id = req.clinic.clinic_id;
  const { slug } = req.params;

  try {
    const decoded = hashids.decode(slug);
    if (!decoded || decoded.length === 0) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const sessionId = decoded[0];

    const result = await pool.query(
      `SELECT id, session_date, is_active, opened_at, closed_at, total_tokens_issued, total_tokens_done, avg_consult_secs 
       FROM queue_sessions 
       WHERE id = $1 AND clinic_id = $2`,
      [sessionId, clinic_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];
    res.status(200).json({ ...session, slug });
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { startSession, getActiveSession, getAllSessions, endSession, getSessionDetails };
