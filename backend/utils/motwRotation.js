const Leaderboard = require('../models/LeaderboardModel');
const CustomLeaderboard = require('../models/CustomLeaderboardModel');
const MotwSubmission = require('../models/MotwSubmissionModel');
const User = require('../models/userModel');
const { replaceTemplateKeywords } = require('./templateReplacer');
const { msToTime } = require('./timeUtil');
const { sendDiscordMessage } = require('./discordUtil');
const { getMotwNumber } = require('../scripts/motwNumber');
const { getMapKey, compareEntries } = require('../controllers/leaderboard/mapUtils');

const buildMotwMessageContent = ({ mapName, mapKey, creator, wrEntry }) => {
    const leaderboardUrl = 'https://pogostuckleaderboards.vercel.app/';
    const mapUrl = `${leaderboardUrl}leaderboards/${mapKey}`;
    const hasWrEntry = Boolean(wrEntry);

    const template = [
        '## New Map Of the Week: [%MAPNAME%](<%MAPURL%>) By: %CREATOR%',
        (hasWrEntry ? 'Current WR: `%WRTIME%` by: [%WRUSER%](<%WRUSERURL%>)' : 'Current WR: `No run yet`'),
        '-# _Submit your best run this week - points are awarded when the next Map of the Week rotation happens._'
    ].join('\n');

    return replaceTemplateKeywords(template, {
        MAPNAME: mapName,
        MAPURL: mapUrl,
        CREATOR: creator,
        WRTIME: hasWrEntry ? msToTime(wrEntry.time) : '',
        WRUSER: hasWrEntry ? wrEntry.userName : '',
        WRUSERURL: hasWrEntry ? `${leaderboardUrl}user/${wrEntry.discordID}` : ''
    });
};

const sendNewMotwMessage = async ({ mapName, mapKey, creator, wrEntry }) => {
    const content = buildMotwMessageContent({ mapName, mapKey, creator, wrEntry });
    await sendDiscordMessage(content);
};

const sendMotwRecapMessage = async (currentFeatured, motwEntries) => {
    try {
        if (!currentFeatured) {
            console.log('No featured leaderboard found for recap');
            return;
        }

        const entries = Array.isArray(motwEntries)
            ? [...motwEntries].sort((a, b) => compareEntries(a, b, currentFeatured.isBoostless))
            : [];

        const participantCount = entries.length;
        const leaderboardUrl = 'https://pogostuckleaderboards.vercel.app/';
        const mapUrl = `${leaderboardUrl}leaderboards/${getMapKey(currentFeatured)}`;

        let podiumContent;
        if (participantCount === 0) {
            podiumContent = 'No participants this week.';
        } else if (participantCount === 1) {
            const first = entries[0];
            podiumContent = `🥇 ${first.userName} - \`${msToTime(first.time)}\``;
        } else if (participantCount === 2) {
            const first = entries[0];
            const second = entries[1];
            podiumContent = `🥇 ${first.userName} - \`${msToTime(first.time)}\`\n🥈 ${second.userName} - \`${msToTime(second.time)}\``;
        } else {
            const first = entries[0];
            const second = entries[1];
            const third = entries[2];
            podiumContent = `🥇 ${first.userName} - \`${msToTime(first.time)}\`\n🥈 ${second.userName} - \`${msToTime(second.time)}\`\n🥉 ${third.userName} - \`${msToTime(third.time)}\``;
        }

        const template = [
            `## Map of the Week Recap: [${currentFeatured.mapName}](<${mapUrl}>)`,
            `**Participants:** ${participantCount}`,
            '',
            '### Top Performers:',
            podiumContent
        ].join('\n');

        await sendDiscordMessage(template);
    } catch (err) {
        console.log('Failed to send MotW recap message:', err);
    }
};

const sampleRandomLeaderboard = async (excludedMapKey = null) => {
    const excludeSteam = excludedMapKey ? { steamID: { $ne: excludedMapKey } } : {};
    const excludeCustom = excludedMapKey ? { id: { $ne: excludedMapKey } } : {};

    const [steamCount, customCount] = await Promise.all([
        Leaderboard.countDocuments(excludeSteam),
        CustomLeaderboard.countDocuments(excludeCustom)
    ]);
    const total = steamCount + customCount;
    if (total === 0) return null;

    const chooseSteam = customCount === 0 || (steamCount > 0 && Math.random() * total < steamCount);
    const response = chooseSteam
        ? await Leaderboard.aggregate([{ $match: excludeSteam }, { $sample: { size: 1 } }])
        : await CustomLeaderboard.aggregate([{ $match: excludeCustom }, { $sample: { size: 1 } }]);
    return response[0] || null;
};

const rotateFeaturedLeaderboard = async ({ awardParticipations = true } = {}) => {
    let previousMap = null;
    try {
        const [currentSteamFeatured, currentCustomFeatured] = await Promise.all([
            Leaderboard.findOneAndUpdate({ featured: true }, { featured: false }),
            CustomLeaderboard.findOneAndUpdate({ featured: true }, { featured: false })
        ]);
        const current = currentSteamFeatured || currentCustomFeatured;
        previousMap = current;
        const motwNumber = getMotwNumber();
        const currentMotwSubmissions = current
            ? await MotwSubmission.findOne({ steamID: getMapKey(current) })
            : null;
        const motwEntries = Array.isArray(currentMotwSubmissions?.entries)
            ? currentMotwSubmissions.entries
            : [];

        if (current && awardParticipations) {
            const entries = [...motwEntries].sort((a, b) => compareEntries(a, b, current.isBoostless));

            for (let i = 0; i < entries.length; i++) {
                const user = await User.findOne({ discordID: entries[i].discordID });

                if (user) {
                    if (!user.mapOfTheWeekParticipations) user.mapOfTheWeekParticipations = [];
                    user.mapOfTheWeekParticipations.push({
                        placement: i,
                        motwNumber: motwNumber - 1
                    });
                    user.save();
                }
            }
            await sendMotwRecapMessage(current, motwEntries);
        }

        await MotwSubmission.deleteMany({});
    } catch (err) {
        console.log(err);
    }

    const excludedMapKey = previousMap ? getMapKey(previousMap) : null;
    const selectedMap = await sampleRandomLeaderboard(excludedMapKey);
    if (!selectedMap) {
        return { selectedMap: null, mapKey: null, previousMap };
    }

    const wrEntries = Array.isArray(selectedMap.entries)
        ? [...selectedMap.entries].sort((a, b) => compareEntries(a, b, selectedMap.isBoostless))
        : [];
    const wrEntry = wrEntries.length ? wrEntries[0] : null;
    const mapKey = getMapKey(selectedMap);

    console.log(selectedMap.mapName);
    if (selectedMap.steamID) {
        await Leaderboard.findOneAndUpdate({ _id: selectedMap._id }, { featured: true });
    } else {
        await CustomLeaderboard.findOneAndUpdate({ _id: selectedMap._id }, { featured: true });
    }

    await MotwSubmission.create({
        mapName: selectedMap.mapName,
        steamID: mapKey,
        mapKey,
        creator: selectedMap.creator,
        entries: []
    });

    try {
        await sendNewMotwMessage({
            mapName: selectedMap.mapName,
            mapKey,
            creator: selectedMap.creator,
            wrEntry
        });
    } catch (err) {
        console.log('Failed to send MotW Discord message:', err);
    }

    return { selectedMap, mapKey, previousMap };
};

module.exports = {
    buildMotwMessageContent,
    sendNewMotwMessage,
    sendMotwRecapMessage,
    sampleRandomLeaderboard,
    rotateFeaturedLeaderboard
};
