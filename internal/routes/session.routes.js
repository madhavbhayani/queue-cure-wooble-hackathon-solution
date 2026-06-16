const express = require('express');
const { startSession, getActiveSession } = require('../controllers/session.controller.js');
const { verifyToken } = require('../middleware/auth.middleware.js');

const router = express.Router();

router.post('/start', verifyToken, startSession);
router.get('/active', verifyToken, getActiveSession);

module.exports = router;
