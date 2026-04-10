const express = require('express');
const router = express.Router();
const { register, login, getProfile, getLeaderboard } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, getProfile);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
