const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);


function parsePasswdLine(line) {

    const parts = line.split(":");

    if (parts.length < 7) {
        return null;
    }

    const [
        username,
        ,
        uid,
        gid,
        gecos,
        homeDirectory,
        shell
    ] = parts;

    const numericUid = Number(uid);
    const numericGid = Number(gid);

    if (
        !Number.isInteger(numericUid) ||
        !Number.isInteger(numericGid)
    ) {
        return null;
    }

    return {
        username,
        uid: numericUid,
        gid: numericGid,
        fullName: gecos || "",
        homeDirectory,
        shell,
        type:
            numericUid === 0
                ? "root"
                : numericUid >= 1000
                    ? "regular"
                    : "system"
    };
}


async function getUsers() {

    const { stdout } = await execFileAsync(
        "getent",
        ["passwd"],
        {
            maxBuffer: 1024 * 1024
        }
    );

    return stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(parsePasswdLine)
        .filter(Boolean);
}


async function getUserByUsername(username) {

    try {

        const { stdout } = await execFileAsync(
            "getent",
            [
                "passwd",
                username
            ]
        );

        const line = stdout.trim();

        if (!line) {
            return null;
        }

        const user = parsePasswdLine(line);

        if (!user) {
            return null;
        }


        // Get group memberships
        const { stdout: groupOutput } =
            await execFileAsync(
                "id",
                [
                    "-nG",
                    username
                ]
            );

        const groups =
            groupOutput
                .trim()
                .split(/\s+/)
                .filter(Boolean);


        return {
            ...user,
            groups
        };

    } catch (error) {

        // getent/id may return non-zero
        // when the user does not exist.
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
    getUsers,
    getUserByUsername
};