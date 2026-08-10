const {
    buildMotwMessageContent,
    sampleRandomLeaderboard,
    rotateFeaturedLeaderboard
} = require('../utils/motwRotation');
const { getMapKey, compareEntries } = require('./leaderboard/mapUtils');

const newFeaturedLeaderboard = async (req, res) => {
    const { selectedMap } = await rotateFeaturedLeaderboard({ awardParticipations: true });
    if (!selectedMap) {
        return res.status(404).json({ error: 'No leaderboard found' });
    }

    res.status(200).json({ msg: "updated MotW" });
};

const previewMotwMessage = async (req, res) => {
    try {
        const randomLeaderboard = await sampleRandomLeaderboard();
        if (!randomLeaderboard) {
            return res.status(404).json({ error: 'No leaderboard found' });
        }

        const selectedMap = randomLeaderboard;
        const wrEntries = Array.isArray(selectedMap.entries)
            ? [...selectedMap.entries].sort((a, b) => compareEntries(a, b, selectedMap.isBoostless))
            : [];
        const wrEntry = wrEntries.length ? wrEntries[0] : null;
        const mapKey = getMapKey(selectedMap);
        const content = buildMotwMessageContent({
            mapName: selectedMap.mapName,
            mapKey,
            creator: selectedMap.creator,
            wrEntry
        });

        return res.status(200).json({
            mapName: selectedMap.mapName,
            content
        });
    } catch (err) {
        console.log('Failed to preview MotW message:', err);
        return res.status(500).json({ error: 'Could not build message preview' });
    }
};

module.exports = {
    newFeaturedLeaderboard,
    previewMotwMessage,
    buildMotwMessageContent
};
