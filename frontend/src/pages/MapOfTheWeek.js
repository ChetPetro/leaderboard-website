import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import CreateEntryForm from "../components/CreateEntryForm";
import { msToTime } from "../timeUtils";
import { useError } from "../context/ErrorContext";
import useAdminAuthorization from "../hooks/useAdminAuthorization";
import useApi from "../hooks/useApi";
import "../styles/pages/MapDetails.css";
import "../styles/pages/MapOfTheWeek.css"
import { getMapKey } from "../utils/mapUtils";
import { compareEntries } from "../utils/entryUtils";

const MapOfTheWeek = ({ user }) => {
    const api = useApi();
    const [map, setMap] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const { showError } = useError();
    const { isAuthorized: isAdminAuthorized } = useAdminAuthorization(user);

    const fetchMap = useCallback(async () => {
        try {
            const json = await api.leaderboards.fetchMOTW();

            if (!json || !getMapKey(json)) {
                showError("Failed to load map of the week");
                setIsLoading(false);
                return;
            }

            const { motwNumber: currentMotwNumber, ...motwData } = json || {};
            setMap({
                ...motwData,
                motwNumber: currentMotwNumber
            });
            setIsLoading(false);
        } catch (error) {
            // Errors are already shown by the API layer.
            setIsLoading(false);
        }
    }, [api, showError]);

    useEffect(() => {
        fetchMap();
    }, [fetchMap]);


    const motwEntries = useMemo(() => {
        const entries = Array.isArray(map?.entries) ? map.entries : [];

        return [...entries].sort((a, b) => compareEntries(a, b, map?.isBoostless));
    }, [map]);

    const handleDeleteEntry = async (entry) => {
        if (!user?.token || !getMapKey(map)) return;

        const confirmed = window.confirm(`Are you sure you want to delete this entry?\n${entry.userName} - ${msToTime(entry.time)}`);
        if (!confirmed) return;

        try {
            await api.admin.deleteMotwEntry(getMapKey(map), entry.discordID, user.token);

            setMap((prev) => {
                const prevEntries = Array.isArray(prev?.entries) ? prev.entries : [];

                return {
                    ...prev,
                    entries: prevEntries.filter((entryEl) => entryEl.discordID !== entry.discordID)
                };
            });

            // Recompute map points after MOTW entry deletion
            await api.admin.recomputeMapPoints(getMapKey(map), user.token);
        } catch (error) {
            // Errors are already shown by the API layer.
        }
    };

    const ownEntry = user?.discordID
        ? motwEntries.find((entry) => entry.discordID === user.discordID)
        : null;

    const handleDeleteOwnEntry = async () => {
        if (!user?.token || !ownEntry) return;
        const confirmed = window.confirm(`Are you sure you want to delete your score?\n${msToTime(ownEntry.time)}`);
        if (!confirmed) return;

        try {
            await api.leaderboards.deleteOwnEntry(getMapKey(map), user.token);
            await fetchMap();
        } catch (error) {
            // Errors are already shown by the API layer.
        }
    };

    const handleRerollMotw = async () => {
        if (!user?.token) return;
        const confirmed = window.confirm(`Are you sure you want to reroll the Map of the Week?\nSubmissions for ${map?.mapName || 'this map'} will be cleared, but nobody's streak is affected.`);
        if (!confirmed) return;

        try {
            await api.admin.rerollMotw(user.token);
            await fetchMap();
        } catch (error) {
            // Errors are already shown by the API layer.
        }
    };

    return (
        <div className="map-details map-of-the-week">
            <div className="inside">
                <h1 className="heading"> <span className="text-gradient">Map</span> of the <span className="text-gradient">week</span> </h1>
                <div className="col-left">
                    <div className="map-hero-placeholder placeholder-wrapper">
                        <div className={"map-hero placeholder-target" + (isLoading ? " is-loading" : "")}>
                            <div className="map-image media-container">
                                <img src={map.previewImage} alt={`${map.mapName} preview`} />
                            </div>
                            <img src={map.previewImage} alt="" className="bg-blurred-img" />
                            <div className="map-info">
                                <h1 className="details-map-name">{map.mapName || "Unknown"}</h1>
                                <div className="details">
                                    <span className="map-creator">By: {map.creator}</span>
                                    {map.difficultyBonus > 0 && (
                                        <div className="difficulty-bonus-cnt">
                                            <div className="hot_pepper media-container"><img src="/hot_pepper.png" alt="" /></div><span className="bonus">+{map.difficultyBonus}</span>
                                        </div>
                                    )}
                                    {map.isBoostless && (<span className="boostless-badge" title="Boostless map: ranked by fewest boosts, then fastest time">Boostless</span>)}
                                </div>
                            </div>
                            {!map?.isCustomLeaderboard && (
                                <a
                                    className="steam-btn btn btn-small"
                                    title={`View ${map?.mapName} on Steam`}
                                    href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${getMapKey(map)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <div className="media-container">
                                        <img src="/Steam.svg" alt="Steam Icon" className="steam-icon" />
                                    </div>
                                </a>
                            )}
                        </div>
                        <div className={"placeholder" + (isLoading ? " is-loading" : "")}>
                            <div className="placeholder-image">
                                <div className="placeholder-block placeholder-block-left with-border"></div>
                                <div className="placeholder-block placeholder-block-right with-border"></div>
                                <div className="placeholder-block placeholder-block-top with-border"></div>
                            </div>
                            <div className="placeholder-info">
                                <div className="placeholder-info-heading">
                                    <div className="placeholder-block placeholder-block-left with-border"></div>
                                    <div className="placeholder-block placeholder-block-right with-border"></div>
                                    <div className="placeholder-block placeholder-block-top with-border"></div>
                                    <div className="placeholder-block placeholder-block-bottom with-border"></div>
                                </div>
                                <div className="placeholder-info-text">
                                    <div className="placeholder-block placeholder-block-left with-border"></div>
                                    <div className="placeholder-block placeholder-block-right with-border"></div>
                                    <div className="placeholder-block placeholder-block-top with-border"></div>
                                    <div className="placeholder-block placeholder-block-bottom with-border"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={"leaderboard map-rankings" + (map?.isBoostless ? ' boostless' : '') + (isAdminAuthorized ? ' admin-view' : '')}>
                        {motwEntries.map((entry, index) => (
                            <div key={entry.discordID}
                                 className={"leaderboard-entry" + (isAdminAuthorized ? ' admin-view' : '')}
                                 style={{'--leaderboard-entry-animation-delay': 500 + 75*index + 'ms'}}>
                                <span className="placing">{index + 1}</span>
                                <Link to={`/user/${entry.discordID}`}>{entry.userName}</Link>
                                <span className="entry-time">{msToTime(entry.time)}</span>
                                {map.isBoostless && (<span className="entry-boosts" title="Boosts used">{entry.boosts ?? 0}</span>)}
                                {isAdminAuthorized && (
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteEntry(entry)}
                                        className="delete-btn btn btn-ghost btn-small"
                                    >
                                        -
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="col-right">
                    { isAdminAuthorized &&
                        <div className="admin-panel card">
                            <h2> Admin Panel </h2>
                            <div className="admin-card-cnt">
                                <div className="buttons-cnt">
                                    <div className="buttons">
                                        <button className="btn btn-red btn-small" onClick={handleRerollMotw} title="Picks a new Map of the Week without awarding participations">
                                            Reroll MotW
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }
                    <div className="submit-entry card">
                        {user.userName && (
                            <CreateEntryForm
                            mapKey={getMapKey(map)}
                                user={user}
                                onEntrySaved={fetchMap}
                                submissionMode="motw"
                                isBoostless={map?.isBoostless === true}
                            />
                        )}
                        {!user.userName && <h2>Login to Submit Entry</h2>}
                    </div>
                    {ownEntry && (
                        <div className="own-entry-panel card">
                            <h2>Your Score</h2>
                            <div className="own-entry-cnt">
                                <span className="own-entry-time">
                                    {msToTime(ownEntry.time)}
                                    {map?.isBoostless && ` (${ownEntry.boosts ?? 0} boosts)`}
                                </span>
                                <button className="btn btn-red btn-small" onClick={handleDeleteOwnEntry}>
                                    Delete My Score
                                </button>
                            </div>
                        </div>
                    )}
                    <div className={"card"}>
                        <h2>Info</h2>
                        <p>Submit your time here or on the actual pap page to submit to the <i>Map Of The Week</i> leaderboard</p>
                        <div className="buttons"><Link to={`/leaderboards/${getMapKey(map)}`} className="btn btn-small btn-primary">Visit Map Page</Link></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MapOfTheWeek;
