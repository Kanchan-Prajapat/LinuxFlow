const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");

const execFileAsync = promisify(execFile);


function parseAclEntry(line) {

    const parts = line.split(":");

    if (parts.length < 3) {
        return null;
    }

    const type = parts[0];
    const name = parts[1] || null;
    const permissions = parts[2];

    if (
        type !== "user" &&
        type !== "group" &&
        type !== "mask" &&
        type !== "other"
    ) {
        return null;
    }

    return {
        type,
        name,
        permissions
    };
}


async function getAcl(targetPath) {

    try {

        const { stdout } = await execFileAsync(
            "getfacl",
            [
                "-p",
                targetPath
            ],
            {
                timeout: 10000,
                maxBuffer: 1024 * 1024
            }
        );


        const lines = stdout
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);


        let owner = null;
        let group = null;

        const entries = [];


        for (const line of lines) {

            if (line.startsWith("# owner:")) {

                owner =
                    line
                        .slice("# owner:".length)
                        .trim();

                continue;
            }


            if (line.startsWith("# group:")) {

                group =
                    line
                        .slice("# group:".length)
                        .trim();

                continue;
            }


            if (line.startsWith("#")) {
                continue;
            }


            const entry =
                parseAclEntry(line);

            if (entry) {
                entries.push(entry);
            }
        }


        const extended =
            entries.some(entry =>
                (
                    entry.type === "user" ||
                    entry.type === "group"
                ) &&
                entry.name !== null
            );


        return {
            success: true,

            data: {
                path: targetPath,
                owner,
                group,
                extended,
                entries
            }
        };


    } catch (error) {

        if (error.code === "ENOENT") {

            return {
                success: false,
                type: "command-missing",
                message:
                    "ACL utilities are not installed"
            };
        }


        const stderr =
            String(error.stderr || "");


        if (
            stderr.includes(
                "No such file or directory"
            )
        ) {

            return {
                success: false,
                type: "not-found",
                message:
                    `Path '${targetPath}' does not exist`
            };
        }


        if (
            stderr
                .toLowerCase()
                .includes("permission denied")
        ) {

            return {
                success: false,
                type: "permission-denied",
                message:
                    `Permission denied for '${targetPath}'`
            };
        }


        throw error;
    }
}


function isProtectedWritePath(targetPath) {

    const normalized =
        path.posix.resolve(targetPath);

    const exactProtectedPaths = new Set([
        "/",
        "/etc",
        "/etc/passwd",
        "/etc/shadow",
        "/etc/group",
        "/etc/gshadow",
        "/etc/sudoers",
        "/boot",
        "/proc",
        "/sys",
        "/dev"
    ]);

    if (exactProtectedPaths.has(normalized)) {
        return true;
    }

    const protectedTrees = [
        "/proc/",
        "/sys/",
        "/dev/",
        "/boot/"
    ];

    return protectedTrees.some(prefix =>
        normalized.startsWith(prefix)
    );
}



async function runAclCommand(args, targetPath) {

    if (isProtectedWritePath(targetPath)) {

        return {
            success: false,
            type: "protected",
            message:
                `ACL changes are not allowed for '${targetPath}'`
        };
    }


    try {

        await execFileAsync(
            "setfacl",
            args,
            {
                timeout: 10000
            }
        );


        const updated =
            await getAcl(targetPath);


        return {
            success: true,
            data: updated.data
        };


    } catch (error) {

        if (error.code === "ENOENT") {

            return {
                success: false,
                type: "command-missing",
                message:
                    "ACL utilities are not installed"
            };
        }


        const stderr =
            String(error.stderr || "");


        if (
            stderr.includes(
                "No such file or directory"
            )
        ) {

            return {
                success: false,
                type: "not-found",
                message:
                    `Path '${targetPath}' does not exist`
            };
        }


        if (
            stderr
                .toLowerCase()
                .includes("permission denied") ||
            stderr
                .toLowerCase()
                .includes("operation not permitted")
        ) {

            return {
                success: false,
                type: "permission-denied",
                message:
                    `Permission denied for '${targetPath}'`
            };
        }


        console.error(
            "setfacl error:",
            stderr || error.message
        );


        return {
            success: false,
            type: "command-error",
            message:
                "Unable to modify ACL"
        };
    }
}



async function setUserAcl(
    targetPath,
    username,
    permissions
) {

    return runAclCommand(
        [
            "-m",
            `u:${username}:${permissions}`,
            targetPath
        ],
        targetPath
    );
}


async function setGroupAcl(
    targetPath,
    groupName,
    permissions
) {

    return runAclCommand(
        [
            "-m",
            `g:${groupName}:${permissions}`,
            targetPath
        ],
        targetPath
    );
}


async function removeUserAcl(
    targetPath,
    username
) {

    return runAclCommand(
        [
            "-x",
            `u:${username}`,
            targetPath
        ],
        targetPath
    );
}


async function removeGroupAcl(
    targetPath,
    groupName
) {

    return runAclCommand(
        [
            "-x",
            `g:${groupName}`,
            targetPath
        ],
        targetPath
    );
}


async function removeAllExtendedAcl(
    targetPath
) {

    return runAclCommand(
        [
            "-b",
            targetPath
        ],
        targetPath
    );
}




module.exports = {
    getAcl,
    setUserAcl,
    setGroupAcl,
    removeUserAcl,
    removeGroupAcl,
    removeAllExtendedAcl
};