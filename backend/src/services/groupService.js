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


async function createGroup(groupName) {

    const existingGroup =
        await getGroupByName(groupName);

    if (existingGroup) {
        return {
            success: false,
            type: "exists",
            message:
                `Group '${groupName}' already exists`
        };
    }

    try {

        await execFileAsync(
            "groupadd",
            [groupName],
            {
                timeout: 10000
            }
        );

        const group =
            await getGroupByName(groupName);

        return {
            success: true,
            group
        };

    } catch (error) {

        console.error(
            "groupadd error:",
            error.stderr || error.message
        );

        return {
            success: false,
            type: "command-error",
            message:
                `Unable to create group '${groupName}'`
        };
    }
}


async function userExists(username) {

    try {

        await execFileAsync(
            "getent",
            ["passwd", username]
        );

        return true;

    } catch (error) {

        if (
            error.code === 1 ||
            error.code === 2
        ) {
            return false;
        }

        throw error;
    }
}


async function addGroupMember(
    groupName,
    username
) {

    const group =
        await getGroupByName(groupName);

    if (!group) {
        return {
            success: false,
            type: "group-not-found",
            message:
                `Group '${groupName}' not found`
        };
    }


    if (!(await userExists(username))) {

        return {
            success: false,
            type: "user-not-found",
            message:
                `User '${username}' not found`
        };
    }


    if (group.members.includes(username)) {

        return {
            success: false,
            type: "already-member",
            message:
                `User '${username}' is already a supplementary member of '${groupName}'`
        };
    }


    try {

        await execFileAsync(
            "usermod",
            [
                "-aG",
                groupName,
                username
            ],
            {
                timeout: 10000
            }
        );


        const updatedGroup =
            await getGroupByName(groupName);


        return {
            success: true,
            group: updatedGroup
        };

    } catch (error) {

        console.error(
            "Add group member error:",
            error.stderr || error.message
        );

        return {
            success: false,
            type: "command-error",
            message:
                `Unable to add '${username}' to '${groupName}'`
        };
    }
}


async function removeGroupMember(
    groupName,
    username
) {

    const group =
        await getGroupByName(groupName);

    if (!group) {

        return {
            success: false,
            type: "group-not-found",
            message:
                `Group '${groupName}' not found`
        };
    }


    if (!(await userExists(username))) {

        return {
            success: false,
            type: "user-not-found",
            message:
                `User '${username}' not found`
        };
    }


    if (!group.members.includes(username)) {

        return {
            success: false,
            type: "not-member",
            message:
                `User '${username}' is not a supplementary member of '${groupName}'`
        };
    }


    try {

        await execFileAsync(
            "gpasswd",
            [
                "-d",
                username,
                groupName
            ],
            {
                timeout: 10000
            }
        );


        const updatedGroup =
            await getGroupByName(groupName);


        return {
            success: true,
            group: updatedGroup
        };

    } catch (error) {

        console.error(
            "Remove group member error:",
            error.stderr || error.message
        );

        return {
            success: false,
            type: "command-error",
            message:
                `Unable to remove '${username}' from '${groupName}'`
        };
    }
}


async function deleteGroup(groupName) {

    const group =
        await getGroupByName(groupName);

    if (!group) {

        return {
            success: false,
            type: "not-found",
            message:
                `Group '${groupName}' not found`
        };
    }


    // Protect critical groups
    const protectedGroups = new Set([
        "root",
        "wheel"
    ]);

    if (protectedGroups.has(groupName)) {

        return {
            success: false,
            type: "protected",
            message:
                `Group '${groupName}' is protected`
        };
    }


    try {

        await execFileAsync(
            "groupdel",
            [groupName],
            {
                timeout: 10000
            }
        );


        return {
            success: true,
            group
        };

    } catch (error) {

        console.error(
            "groupdel error:",
            error.stderr || error.message
        );

        return {
            success: false,
            type: "command-error",
            message:
                `Unable to delete group '${groupName}'`
        };
    }
}


module.exports = {
    getGroups,
    getGroupByName,
    createGroup,
        addGroupMember,
    removeGroupMember,
    deleteGroup

};