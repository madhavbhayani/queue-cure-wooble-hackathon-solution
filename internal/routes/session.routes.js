const express = require('express');
const { startSession, getActiveSession, getAllSessions, endSession, getSessionDetails } = require('../controllers/session.controller.js');
const { verifyToken } = require('../middleware/auth.middleware.js');

const router = express.Router();

router.post('/start', verifyToken, startSession);
router.get('/active', verifyToken, getActiveSession);
router.get('/list', verifyToken, getAllSessions);
router.get('/:slug', verifyToken, getSessionDetails);
router.put('/:slug/end', verifyToken, endSession);

module.exports = router;
