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


function isProtectedUser(username) {

    const protectedUsers = new Set([
        "root"
    ]);

    return protectedUsers.has(username);
}


async function createUser({
    username,
    fullName,
    shell,
    createHome
}) {

    const existingUser =
        await getUserByUsername(username);

    if (existingUser) {
        return {
            success: false,
            type: "exists",
            message: `User '${username}' already exists`
        };
    }


    const args = [];

    if (createHome) {
        args.push("-m");
    } else {
        args.push("-M");
    }

    if (fullName) {
        args.push("-c", fullName);
    }

    if (shell) {
        args.push("-s", shell);
    }

    args.push(username);


    try {

        await execFileAsync(
            "useradd",
            args,
            {
                timeout: 10000
            }
        );

        const createdUser =
            await getUserByUsername(username);

        return {
            success: true,
            user: createdUser
        };

    } catch (error) {

        console.error(
            "useradd error:",
            error.stderr || error.message
        );

        return {
            success: false,
            type: "command-error",
            message: `Unable to create user '${username}'`
        };
    }
}


async function changeUserLockState(
    username,
    action
) {

    const user =
        await getUserByUsername(username);

    if (!user) {

        return {
            success: false,
            type: "not-found",
            message: `User '${username}' not found`
        };
    }


    if (isProtectedUser(username)) {

        return {
            success: false,
            type: "protected",
            message:
                `User '${username}' is protected`
        };
    }


    const flag =
        action === "lock"
            ? "-L"
            : action === "unlock"
                ? "-U"
                : null;


    if (!flag) {

        return {
            success: false,
            type: "invalid-action",
            message:
                "Invalid user account action"
        };
    }


    try {

        await execFileAsync(
            "usermod",
            [
                flag,
                username
            ],
            {
                timeout: 10000
            }
        );


        return {
            success: true,
            action,
            user
        };

    } catch (error) {

        console.error(
            "usermod error:",
            error.stderr || error.message
        );

        return {
            success: false,
            type: "command-error",
            message:
                `Unable to ${action} user '${username}'`
        };
    }
}



module.exports = {
    getUsers,
    getUserByUsername,
       createUser,
    changeUserLockState
};