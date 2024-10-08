import { Link } from 'react-router-dom';

const LeaderboardEntry = ({ entry, pos }) => {
    const msToTime = (duration) => {
        var milliseconds = duration.toString().slice(-3);
        var seconds = Math.floor((duration / 1000) % 60);
        var minutes = Math.floor((duration / (1000 * 60)) % 60);
        var hours = Math.floor(duration / (1000 * 60 * 60));

        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;
        hours = (hours < 10) ? "0" + hours : hours;

        return hours + ':' + minutes + ':' + seconds + '.' + milliseconds;
    }

    return (
        <tr className="leaderboard-entry">
            <td >{ pos }</td>
            <td>{ msToTime(entry.time) }</td>
            <td><Link to={`/user/${entry.discordID}`}><td>{ entry.userName }</td></Link></td>
        </tr>
    );
}
 
export default LeaderboardEntry;