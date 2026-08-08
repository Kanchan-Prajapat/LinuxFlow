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
// Get All / Filtered Logs
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


    // User filter
    if (user) {

        const userValue =
            String(user).toLowerCase();

        logs =
            logs.filter(log =>
                log.user
                    .toLowerCase()
                    === userValue
            );
    }


    // Host filter
    if (host) {

        const hostValue =
            String(host).toLowerCase();

        logs =
            logs.filter(log =>
                log.host
                    .toLowerCase()
                    === hostValue
            );
    }


    // Search filter
    if (search) {

        const searchValue =
            String(search).toLowerCase();

        logs =
            logs.filter(log =>
                log.message
                    .toLowerCase()
                    .includes(searchValue)
                ||
                log.raw
                    .toLowerCase()
                    .includes(searchValue)
            );
    }


    // From date
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


    // To date
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


    // Limit - backward compatibility
    if (limit !== undefined) {

        const safeLimit =
            Math.max(
                1,
                Math.min(
                    Number(limit) || 20,
                    100
                )
            );

        logs =
            logs
                .slice(-safeLimit)
                .reverse();
    }


    return logs;
}


// ########################################################
// Paginated Logs
// ########################################################

async function getPaginatedLogs(
    options = {}
) {

    const {
        page = 1,
        pageSize = 10,
        ...filters
    } = options;


    const safePage =
        Math.max(
            1,
            Number(page) || 1
        );


    const safePageSize =
        Math.max(
            1,
            Math.min(
                Number(pageSize) || 10,
                100
            )
        );


    // Get filtered logs WITHOUT limit
    const logs =
        await getLogs(filters);


    const total =
        logs.length;


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total / safePageSize
            )
        );


    const currentPage =
        Math.min(
            safePage,
            totalPages
        );


    const start =
        (currentPage - 1)
        * safePageSize;


    const paginatedLogs =
        logs
            .slice()
            .reverse()
            .slice(
                start,
                start + safePageSize
            );


    return {
        logs: paginatedLogs,

        pagination: {
            page: currentPage,
            pageSize: safePageSize,
            total,
            totalPages,
            hasNextPage:
                currentPage < totalPages,
            hasPreviousPage:
                currentPage > 1
        }
    };
}


// ########################################################
// Recent Logs
// ########################################################

async function getRecentLogs(
    limit = 20
) {

    return getLogs({
        limit
    });
}


// ########################################################
// Log Statistics
// ########################################################

async function getLogStats() {

    const logs =
        await getLogs();


    const users =
        [
            ...new Set(
                logs.map(
                    log => log.user
                )
            )
        ];


    const hosts =
        [
            ...new Set(
                logs.map(
                    log => log.host
                )
            )
        ];


    const started =
        logs.filter(log =>
            log.message
                .toLowerCase()
                .includes("started")
        ).length;


    const closed =
        logs.filter(log =>
            log.message
                .toLowerCase()
                .includes("closed")
        ).length;


    const lastActivity =
        logs.length > 0
            ? logs[logs.length - 1]
            : null;


    return {

        totalLogs:
            logs.length,

        uniqueUsers:
            users.length,

        users,

        uniqueHosts:
            hosts.length,

        hosts,

        started,

        closed,

        lastActivity
    };
}// ########################################################
// Log Statistics
// ########################################################

async function getLogStats() {

    const logs =
        await getLogs();


    const users =
        [
            ...new Set(
                logs.map(
                    log => log.user
                )
            )
        ];


    const hosts =
        [
            ...new Set(
                logs.map(
                    log => log.host
                )
            )
        ];


    const started =
        logs.filter(log =>
            log.message
                .toLowerCase()
                .includes("started")
        ).length;


    const closed =
        logs.filter(log =>
            log.message
                .toLowerCase()
                .includes("closed")
        ).length;


    const lastActivity =
        logs.length > 0
            ? logs[logs.length - 1]
            : null;


    return {

        totalLogs:
            logs.length,

        uniqueUsers:
            users.length,

        users,

        uniqueHosts:
            hosts.length,

        hosts,

        started,

        closed,

        lastActivity
    };
}

// ########################################################
// Exports
// ########################################################

module.exports = {
    getLogs,
    getPaginatedLogs,
    getRecentLogs,
     getLogStats
};