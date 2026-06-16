const { pool } = require('../database/connection/db.js');
const { generateToken } = require('../middleware/auth.middleware.js');

// Utility to generate a URL-safe slug for the clinic
const generateSlug = (name) => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
};

const signup = async (req, res) => {
  const { name, phone, pin, address } = req.body;

  if (!name || !phone || !pin || !address) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Check for duplication by phone number
    const checkDuplication = await pool.query('SELECT id FROM clinics WHERE phone = $1', [phone]);
    if (checkDuplication.rows.length > 0) {
      return res.status(409).json({ error: 'A clinic with this phone number already exists.' });
    }

    const slug = generateSlug(name);
    
    // Assuming the register_clinic function from database_desgin.sql is executed in the DB
    // We can also insert directly if the function is not used, but using the function is safer
    const result = await pool.query(
      `SELECT * FROM register_clinic($1, $2, $3, $4, $5)`,
      [name, slug, phone, address, pin]
    );

    const clinic = result.rows[0];

    const token = generateToken({ clinic_id: clinic.clinic_id, phone });

    res.status(201).json({ message: 'Clinic registered successfully', token, clinic });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const login = async (req, res) => {
  const { phone, pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN are required.' });
  }

  try {
    // PostgreSQL uses pgcrypto's crypt() to verify the pin_hash
    const result = await pool.query(
      `SELECT id, name, slug FROM clinics WHERE phone = $1 AND pin_hash = crypt($2, pin_hash)`,
      [phone, pin]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone number or PIN.' });
    }

    const clinic = result.rows[0];

    const token = generateToken({ clinic_id: clinic.id, phone });

    res.status(200).json({ message: 'Login successful', token, clinic });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const verify = async (req, res) => {
  // If the request makes it here, the verifyToken middleware already validated the JWT.
  // We can just return success and the decoded clinic info.
  res.status(200).json({ valid: true, clinic: req.clinic });
};

module.exports = { signup, login, verify };
