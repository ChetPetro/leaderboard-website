const express = require('express');
const { deleteEntryByMapAndDiscord, deleteMotwEntryByMapAndDiscord, deleteLeaderboardBySteamID, logMapPointsForLeaderboard, recomputeMapPointsAdmin, rerollFeaturedLeaderboard } = require('../controllers/leaderboard/adminController');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/status', (req, res) => {
	res.status(200).json({ isAdmin: true });
});

router.delete('/leaderboards/:mapKey/entries/:discordID', deleteEntryByMapAndDiscord);
router.delete('/leaderboards/:mapKey/motw/entries/:discordID', deleteMotwEntryByMapAndDiscord);
router.delete('/leaderboards/:mapKey', deleteLeaderboardBySteamID);
router.get('/leaderboards/:mapKey/map-points', logMapPointsForLeaderboard);
router.post('/leaderboards/:mapKey/recompute-map-points', recomputeMapPointsAdmin);
router.post('/motw/reroll', rerollFeaturedLeaderboard);

module.exports = router;
