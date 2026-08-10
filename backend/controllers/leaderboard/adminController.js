const Leaderboard = require('../../models/LeaderboardModel');
const CustomLeaderboard = require('../../models/CustomLeaderboardModel');
const MotwSubmission = require('../../models/MotwSubmissionModel');
const User = require('../../models/userModel');
const {
    buildComputedMapPointsForLeaderboard,
    recomputeMapPointsForLeaderboard
} = require('./shared');
const { resolveLeaderboardByKey, getMapKey, withMapKey } = require('./mapUtils');
const { rotateFeaturedLeaderboard } = require('../../utils/motwRotation');

const deleteEntryByMapAndDiscord = async (req, res) => {
    try {
        const { mapKey, discordID } = req.params;
        const resolved = await resolveLeaderboardByKey(mapKey);
        const map = resolved.map;
        if (!map) return res.status(404).json({ error: 'No leadearboard found' });

        const filteredEntries = map.entries.filter((entry) => entry.discordID !== discordID);
        if (filteredEntries.length === map.entries.length) {
            return res.status(404).json({ error: 'No entry found for this map and discordID' });
        }

        const lastSubmissionAt = filteredEntries.reduce((latest, entry) => {
            if (!entry?.submittedAt) return latest;
            const submittedAt = new Date(entry.submittedAt);
            if (Number.isNaN(submittedAt.getTime())) return latest;
            if (!latest || submittedAt > latest) return submittedAt;
            return latest;
        }, null);

        map.entries = filteredEntries;
        map.lastSubmissionAt = lastSubmissionAt;
        await map.save();

        // The recompute below only touches users that still have an entry,
        // so the deleted user's mapPoints must be pulled here.
        const mapKeyValue = getMapKey(map);
        await User.updateOne(
            { discordID, 'mapPoints.mapKey': mapKeyValue },
            { $pull: { mapPoints: { mapKey: mapKeyValue } } }
        );
        await User.updateOne(
            { discordID, 'mapPoints.mapSteamID': mapKeyValue },
            { $pull: { mapPoints: { mapSteamID: mapKeyValue } } }
        );

        await recomputeMapPointsForLeaderboard({
            finalEntries: filteredEntries,
            mapKey: mapKeyValue,
            difficultyBonus: map.difficultyBonus,
            isBoostless: map.isBoostless
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

const deleteMotwEntryByMapAndDiscord = async (req, res) => {
    try {
        const { mapKey, discordID } = req.params;
        const resolved = await resolveLeaderboardByKey(mapKey);
        const map = resolved.map;
        if (!map) return res.status(404).json({ error: 'No leadearboard found' });

        const motwSubmission = await MotwSubmission.findOne({ steamID: getMapKey(map) });
        if (!motwSubmission) return res.status(404).json({ error: 'No MOTW submission found for this map' });

        const filteredEntries = motwSubmission.entries.filter((entry) => entry.discordID !== discordID);
        if (filteredEntries.length === motwSubmission.entries.length) {
            return res.status(404).json({ error: 'No MOTW entry found for this map and discordID' });
        }

        const lastSubmissionAt = filteredEntries.reduce((latest, entry) => {
            if (!entry?.submittedAt) return latest;
            const submittedAt = new Date(entry.submittedAt);
            if (Number.isNaN(submittedAt.getTime())) return latest;
            if (!latest || submittedAt > latest) return submittedAt;
            return latest;
        }, null);

        motwSubmission.entries = filteredEntries;
        motwSubmission.lastSubmissionAt = lastSubmissionAt;
        await motwSubmission.save();
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

const deleteLeaderboardBySteamID = async (req, res) => {
    try {
        const { mapKey } = req.params;
        const resolved = await resolveLeaderboardByKey(mapKey);
        const map = resolved.map;
        if (!map) return res.status(404).json({ error: 'No leadearboard found' });

        const mapKeyValue = getMapKey(map);
        if (resolved.mapType === 'custom') {
            await CustomLeaderboard.deleteOne({ id: mapKeyValue });
        } else {
            await Leaderboard.deleteOne({ steamID: mapKeyValue });
        }

        await MotwSubmission.deleteOne({ steamID: mapKeyValue });
        await User.updateMany(
            { 'mapPoints.mapKey': mapKeyValue },
            { $pull: { mapPoints: { mapKey: mapKeyValue } } }
        );
        await User.updateMany(
            { 'mapPoints.mapSteamID': mapKeyValue },
            { $pull: { mapPoints: { mapSteamID: mapKeyValue } } }
        );
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

const logMapPointsForLeaderboard = async (req, res) => {
    try {
        const { mapKey } = req.params;
        const resolved = await resolveLeaderboardByKey(mapKey);
        const map = resolved.map;
        if (!map) return res.status(404).json({ error: 'No leadearboard found' });

        const mapKeyValue = getMapKey(map);
        const normalizedMap = withMapKey(map);
        const { computedMapPoints, distinctDiscordIDs, effectiveDifficultyBonus } = buildComputedMapPointsForLeaderboard({
            finalEntries: Array.isArray(map.entries) ? map.entries : [],
            mapKey: mapKeyValue,
            difficultyBonus: map.difficultyBonus,
            isBoostless: map.isBoostless
        });
        const users = distinctDiscordIDs.length === 0
            ? []
            : await User.find(
                { discordID: { $in: distinctDiscordIDs } },
                { mapPoints: 1, discordID: 1, userName: 1 }
            ).lean();
        const usersByDiscordID = new Map(users.map((user) => [user.discordID, user]));
        const usersWithMapPoints = computedMapPoints.map((computedMapPoint) => {
            const user = usersByDiscordID.get(computedMapPoint.discordID);
            const currentMapPoint = Array.isArray(user?.mapPoints)
                ? user.mapPoints.find((entry) => (entry.mapKey || entry.mapSteamID) === mapKeyValue) || null
                : null;
            return {
                discordID: computedMapPoint.discordID,
                userName: computedMapPoint.userName,
                computedMapPoint,
                currentMapPoint,
                mapPoints: Array.isArray(user?.mapPoints) ? user.mapPoints : []
            };
        });
        return res.status(200).json({
            map: {
                ...normalizedMap,
                difficultyBonus: map.difficultyBonus,
                effectiveDifficultyBonus
            },
            computedMapPoints,
            users: usersWithMapPoints
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

const recomputeMapPointsAdmin = async (req, res) => {
    try {
        const { mapKey } = req.params;
        const resolved = await resolveLeaderboardByKey(mapKey);
        const map = resolved.map;
        if (!map) return res.status(404).json({ error: 'No leadearboard found' });

        const mapKeyValue = getMapKey(map);
        const recomputeDebugInfo = await recomputeMapPointsForLeaderboard({
            finalEntries: Array.isArray(map.entries) ? map.entries : [],
            mapKey: mapKeyValue,
            difficultyBonus: map.difficultyBonus,
            isBoostless: map.isBoostless
        });
        return res.status(200).json({
            success: true,
            mapName: map.mapName,
            mapKey: mapKeyValue,
            debugInfo: recomputeDebugInfo
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

// Reroll the Map of the Week, e.g. when an unplayable map got picked.
// Unlike the weekly cron rotation this does NOT award participations or send a
// recap, so nobody's MotW streak is affected. Submissions for the rejected map
// are still cleared and the new MotW announcement is still sent.
const rerollFeaturedLeaderboard = async (req, res) => {
    try {
        const { selectedMap, mapKey, previousMap } = await rotateFeaturedLeaderboard({
            awardParticipations: false
        });
        if (!selectedMap) {
            return res.status(404).json({ error: 'No leadearboard found' });
        }

        return res.status(200).json({
            success: true,
            mapName: selectedMap.mapName,
            mapKey,
            previousMapName: previousMap?.mapName ?? null,
            previousMapKey: previousMap ? getMapKey(previousMap) : null
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};

module.exports = {
    deleteEntryByMapAndDiscord,
    deleteMotwEntryByMapAndDiscord,
    deleteLeaderboardBySteamID,
    logMapPointsForLeaderboard,
    recomputeMapPointsAdmin,
    rerollFeaturedLeaderboard
};
