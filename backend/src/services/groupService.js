const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);


function parseGroupLine(line) {

    const parts = line.split(":");

    if (parts.length < 4) {
        return null;
    }

    const [
        groupName,
        ,
        gid,
        memberString
    ] = parts;

    const numericGid = Number(gid);

    if (!Number.isInteger(numericGid)) {
        return null;
    }

    const members =
        memberString
            ? memberString
                .split(",")
                .filter(Boolean)
            : [];

    return {
        groupName,
        gid: numericGid,
        members
    };
}


async function getGroups() {

    const { stdout } = await execFileAsync(
        "getent",
        ["group"],
        {
            maxBuffer: 1024 * 1024
        }
    );

    return stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(parseGroupLine)
        .filter(Boolean);
}


async function getGroupByName(groupName) {

    try {

        const { stdout } = await execFileAsync(
            "getent",
            [
                "group",
                groupName
            ]
        );

        const line = stdout.trim();

        if (!line) {
            return null;
        }

        return parseGroupLine(line);

    } catch (error) {

        if (
            error.code === 1 ||
            error.code === 2
        ) {
            return null;
        }

        throw error;
    }
}


module.exports = {
    getGroups,
    getGroupByName
};