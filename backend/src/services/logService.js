const fs = require("fs");
const path = require("path");


// ########################################################
// Log Configuration
// ########################################################

const LOG_FILE =
    path.resolve(
        __dirname,
        "../../../logs/activity.log"
    );


// ########################################################
// Parse Log Line
// ########################################################

function parseLogLine(line) {

    const parts =
        line.split("|").map(
            part => part.trim()
        );


    if (parts.length < 4) {
        return null;
    }


    const timestamp =
        parts[0];

    const user =
        parts[1].replace(
            /^USER=/,
            ""
        );

    const host =
        parts[2].replace(
            /^HOST=/,
            ""
        );

    const message =
        parts
            .slice(3)
            .join(" | ")
            .trim();


    return {
        timestamp,
        user,
        host,
        message,
        raw: line
    };
}



// ########################################################
// Parse Log Timestamp
// ########################################################

function parseLogTimestamp(timestamp) {

    const match =
        timestamp.match(
            /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
        );


    if (!match) {
        return null;
    }


    const [
        ,
        day,
        month,
        year,
        hours,
        minutes,
        seconds
    ] = match;


    const date =
        new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hours),
            Number(minutes),
            Number(seconds)
        );


    if (Number.isNaN(date.getTime())) {
        return null;
    }


    return date;
}

// ########################################################
// Get All Logs
// ########################################################

async function getLogs(options = {}) {

    const content =
        await fs.promises.readFile(
            LOG_FILE,
            "utf8"
        );


    const lines =
        content
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);


    let logs = [];


    for (const line of lines) {

        const parsed =
            parseLogLine(line);


        if (parsed) {
            logs.push(parsed);
        }
    }


    
const {
    user,
    host,
    search,
    limit,
    from,
    to
} = options;

// Date range filter

if (from) {

    const fromDate =
        parseLogTimestamp(
            `${from} 00:00:00`
        );


    if (fromDate) {

        logs =
            logs.filter(log => {

                const logDate =
                    parseLogTimestamp(
                        log.timestamp
                    );


                return (
                    logDate &&
                    logDate >= fromDate
                );
            });
    }
}


if (to) {

    const toDate =
        parseLogTimestamp(
            `${to} 23:59:59`
        );


    if (toDate) {

        logs =
            logs.filter(log => {

                const logDate =
                    parseLogTimestamp(
                        log.timestamp
                    );


                return (
                    logDate &&
                    logDate <= toDate
                );
            });
    }
}



    // User filter
    if (options.user) {

        const user =
            String(options.user)
                .toLowerCase();

        logs =
            logs.filter(log =>
                log.user
                    .toLowerCase()
                    === user
            );
    }


    // Host filter
    if (options.host) {

        const host =
            String(options.host)
                .toLowerCase();

        logs =
            logs.filter(log =>
                log.host
                    .toLowerCase()
                    === host
            );
    }


    // Message / general search
    if (options.search) {

        const search =
            String(options.search)
                .toLowerCase();

        logs =
            logs.filter(log =>
                log.message
                    .toLowerCase()
                    .includes(search)
                ||
                log.raw
                    .toLowerCase()
                    .includes(search)
            );
    }


    // Limit
    if (options.limit !== undefined) {

        const limit =
            Math.max(
                1,
                Math.min(
                    Number(options.limit) || 20,
                    100
                )
            );


        logs =
            logs.slice(-limit)
                .reverse();
    }


    return logs;
}


// ########################################################
// Get Recent Logs
// ########################################################

async function getRecentLogs(
    limit = 20
) {

    return getLogs({
        limit
    });
}


module.exports = {
    getLogs,
    getRecentLogs
};