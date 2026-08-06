const fs = require("fs/promises");
const path = require("path");


function getFileType(stats) {

    if (stats.isFile()) {
        return "file";
    }

    if (stats.isDirectory()) {
        return "directory";
    }

    if (stats.isSymbolicLink()) {
        return "symlink";
    }

    if (stats.isBlockDevice()) {
        return "block-device";
    }

    if (stats.isCharacterDevice()) {
        return "character-device";
    }

    if (stats.isFIFO()) {
        return "fifo";
    }

    if (stats.isSocket()) {
        return "socket";
    }

    return "unknown";
}


function getSymbolicPermissions(mode) {

    const permissions = mode & 0o777;

    const flags = [
        [0o400, "r"],
        [0o200, "w"],
        [0o100, "x"],

        [0o040, "r"],
        [0o020, "w"],
        [0o010, "x"],

        [0o004, "r"],
        [0o002, "w"],
        [0o001, "x"]
    ];

    return flags
        .map(([flag, character]) =>
            permissions & flag
                ? character
                : "-"
        )
        .join("");
}


async function resolveUserName(uid) {

    try {

        const { execFile } =
            require("child_process");

        const { promisify } =
            require("util");

        const execFileAsync =
            promisify(execFile);

        const { stdout } =
            await execFileAsync(
                "getent",
                ["passwd", String(uid)]
            );

        const username =
            stdout
                .trim()
                .split(":")[0];

        return username || null;

    } catch (error) {
        return null;
    }
}


async function resolveGroupName(gid) {

    try {

        const { execFile } =
            require("child_process");

        const { promisify } =
            require("util");

        const execFileAsync =
            promisify(execFile);

        const { stdout } =
            await execFileAsync(
                "getent",
                ["group", String(gid)]
            );

        const groupName =
            stdout
                .trim()
                .split(":")[0];

        return groupName || null;

    } catch (error) {
        return null;
    }
}


async function getPermissions(targetPath) {

    try {

        const stats =
            await fs.lstat(targetPath);

        const owner =
            await resolveUserName(stats.uid);

        const group =
            await resolveGroupName(stats.gid);

        const octalPermissions =
            (stats.mode & 0o777)
                .toString(8)
                .padStart(3, "0");

        return {
            success: true,

            data: {
                path: targetPath,
                type: getFileType(stats),

                owner: {
                    name: owner,
                    uid: stats.uid
                },

                group: {
                    name: group,
                    gid: stats.gid
                },

                permissions: {
                    octal: octalPermissions,
                    symbolic:
                        getSymbolicPermissions(
                            stats.mode
                        )
                },

                sizeBytes: stats.size,

                modifiedAt:
                    stats.mtime.toISOString(),

                accessedAt:
                    stats.atime.toISOString()
            }
        };

    } catch (error) {

        if (error.code === "ENOENT") {

            return {
                success: false,
                type: "not-found",
                message:
                    `Path '${targetPath}' does not exist`
            };
        }


        if (
            error.code === "EACCES" ||
            error.code === "EPERM"
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
        path.resolve(targetPath);

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
        "/dev/"
    ];

    return protectedTrees.some(prefix =>
        normalized.startsWith(prefix)
    );
}


async function changePermissions(
    targetPath,
    mode
) {

    if (isProtectedWritePath(targetPath)) {

        return {
            success: false,
            type: "protected",
            message:
                `Permission changes are not allowed for '${targetPath}'`
        };
    }

    try {

        await fs.chmod(
            targetPath,
            parseInt(mode, 8)
        );

        const updated =
            await getPermissions(targetPath);

        return {
            success: true,
            data: updated.data
        };

    } catch (error) {

        if (error.code === "ENOENT") {

            return {
                success: false,
                type: "not-found",
                message:
                    `Path '${targetPath}' does not exist`
            };
        }

        if (
            error.code === "EACCES" ||
            error.code === "EPERM"
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


async function changeOwnership(
    targetPath,
    uid,
    gid
) {

    if (isProtectedWritePath(targetPath)) {

        return {
            success: false,
            type: "protected",
            message:
                `Ownership changes are not allowed for '${targetPath}'`
        };
    }

    try {

        await fs.chown(
            targetPath,
            uid,
            gid
        );

        const updated =
            await getPermissions(targetPath);

        return {
            success: true,
            data: updated.data
        };

    } catch (error) {

        if (error.code === "ENOENT") {

            return {
                success: false,
                type: "not-found",
                message:
                    `Path '${targetPath}' does not exist`
            };
        }

        if (
            error.code === "EACCES" ||
            error.code === "EPERM"
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


module.exports = {
    getPermissions,
    changePermissions,
    changeOwnership
};