const fs = require("fs");
const path = require("path");


// ########################################################
// Log Configuration
// ########################################################

const LOG_FILE =
    path.resolve(
        __dirname,
        "../../logs/activity.log"
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
// Read Logs
// ########################################################

async function getLogs() {

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


    const logs = [];


    for (const line of lines) {

        const parsed =
            parseLogLine(line);


        if (parsed) {
            logs.push(parsed);
        }
    }


    return logs;
}


// ########################################################
// Recent Logs
// ########################################################

async function getRecentLogs(limit = 20) {

    const logs =
        await getLogs();


    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 20,
                100
            )
        );


    return logs.slice(
        -safeLimit
    ).reverse();
}


module.exports = {
    getLogs,
    getRecentLogs
};