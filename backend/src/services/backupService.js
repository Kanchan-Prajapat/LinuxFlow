const fs = require("fs/promises");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const BACKUP_DIR = "/var/backups/linuxflow";
const RESTORE_DIR =
    "/var/lib/linuxflow/restores";



async function ensureBackupDirectory() {

    await fs.mkdir(
        BACKUP_DIR,
        {
            recursive: true,
            mode: 0o700
        }
    );
}


function createBackupFilename(sourcePath) {

    const baseName =
        path.basename(sourcePath)
            .replace(/[^a-zA-Z0-9._-]/g, "_");

    const timestamp =
        new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

    return `${baseName}-${timestamp}.tar.gz`;
}


async function pathExists(targetPath) {

    try {

        await fs.access(targetPath);
        return true;

    } catch (error) {

        if (error.code === "ENOENT") {
            return false;
        }

        throw error;
    }
}


async function createBackup(sourcePath) {

    if (!(await pathExists(sourcePath))) {

        return {
            success: false,
            type: "not-found",
            message:
                `Source path '${sourcePath}' does not exist`
        };
    }


    await ensureBackupDirectory();


    const filename =
        createBackupFilename(sourcePath);

    const destination =
        path.join(
            BACKUP_DIR,
            filename
        );


    /*
     * Use tar with:
     *
     * -C parent-directory
     * basename
     *
     * instead of passing arbitrary shell strings.
     */

    const parentDirectory =
        path.dirname(sourcePath);

    const sourceName =
        path.basename(sourcePath);


    try {

        await execFileAsync(
            "tar",
            [
                "-czf",
                destination,
                "-C",
                parentDirectory,
                sourceName
            ],
            {
                timeout: 120000,
                maxBuffer: 1024 * 1024
            }
        );


        const stats =
            await fs.stat(destination);


        return {
            success: true,

            backup: {
                filename,
                sourcePath,
                path: destination,
                sizeBytes: stats.size,
                createdAt:
                    stats.birthtime.toISOString()
            }
        };


    } catch (error) {

        // Remove incomplete archive if tar failed
        try {
            await fs.unlink(destination);
        } catch (_) {
            // Ignore cleanup error
        }


        console.error(
            "Backup creation error:",
            error.stderr || error.message
        );


        return {
            success: false,
            type: "backup-error",
            message:
                "Unable to create backup"
        };
    }
}


async function getBackups() {

    await ensureBackupDirectory();


    const entries =
        await fs.readdir(
            BACKUP_DIR,
            {
                withFileTypes: true
            }
        );


    const backups = [];


    for (const entry of entries) {

        if (
            !entry.isFile() ||
            !entry.name.endsWith(".tar.gz")
        ) {
            continue;
        }


        const backupPath =
            path.join(
                BACKUP_DIR,
                entry.name
            );


        const stats =
            await fs.stat(backupPath);


        backups.push({
            filename: entry.name,
            sizeBytes: stats.size,
            createdAt:
                stats.birthtime.toISOString()
        });
    }


    backups.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );


    return backups;
}


async function getBackupByFilename(filename) {

    await ensureBackupDirectory();


    // Filename only — never arbitrary paths
    if (path.basename(filename) !== filename) {
        return null;
    }


    const backupPath =
        path.join(
            BACKUP_DIR,
            filename
        );


    try {

        const stats =
            await fs.stat(backupPath);


        if (!stats.isFile()) {
            return null;
        }


        const { stdout } =
            await execFileAsync(
                "tar",
                [
                    "-tzf",
                    backupPath
                ],
                {
                    timeout: 30000,
                    maxBuffer: 5 * 1024 * 1024
                }
            );


        const contents =
            stdout
                .split("\n")
                .filter(Boolean);


        return {
            filename,
            path: backupPath,
            sizeBytes: stats.size,
            createdAt:
                stats.birthtime.toISOString(),
            itemCount:
                contents.length,
            contents
        };


    } catch (error) {

        if (error.code === "ENOENT") {
            return null;
        }

        throw error;
    }
}


function isValidBackupFilename(filename) {

    return (
        typeof filename === "string" &&
        /^[a-zA-Z0-9._-]+\.tar\.gz$/.test(filename) &&
        path.basename(filename) === filename
    );
}


async function validateArchive(filename) {

    const backupPath =
        path.join(BACKUP_DIR, filename);

    try {

        const { stdout } =
            await execFileAsync(
                "tar",
                ["-tzf", backupPath],
                {
                    timeout: 30000,
                    maxBuffer: 5 * 1024 * 1024
                }
            );


        const entries =
            stdout
                .split("\n")
                .filter(Boolean);


        for (const entry of entries) {

            // Reject absolute archive paths
            if (entry.startsWith("/")) {

                return {
                    success: false,
                    message:
                        "Archive contains an unsafe absolute path"
                };
            }


            const normalized =
                path.posix.normalize(entry);


            // Reject directory traversal
            if (
                normalized === ".." ||
                normalized.startsWith("../")
            ) {

                return {
                    success: false,
                    message:
                        "Archive contains unsafe path traversal"
                };
            }
        }


        return {
            success: true,
            entries
        };


    } catch (error) {

        if (error.code === "ENOENT") {

            return {
                success: false,
                type: "not-found",
                message:
                    `Backup '${filename}' not found`
            };
        }


        return {
            success: false,
            type: "invalid-archive",
            message:
                "Unable to validate backup archive"
        };
    }
}


async function restoreBackup(filename) {

    if (!isValidBackupFilename(filename)) {

        return {
            success: false,
            type: "invalid-filename",
            message:
                "Invalid backup filename"
        };
    }


    const backupPath =
        path.join(BACKUP_DIR, filename);


    const validation =
        await validateArchive(filename);


    if (!validation.success) {
        return validation;
    }


    await fs.mkdir(
        RESTORE_DIR,
        {
            recursive: true,
            mode: 0o700
        }
    );


    const restoreName =
        filename.replace(
            /\.tar\.gz$/,
            ""
        );


    const destination =
        path.join(
            RESTORE_DIR,
            restoreName
        );


    // Never silently overwrite previous restore
    if (await pathExists(destination)) {

        return {
            success: false,
            type: "exists",
            message:
                `Restore destination '${destination}' already exists`
        };
    }


    try {

        await fs.mkdir(
            destination,
            {
                recursive: false,
                mode: 0o700
            }
        );


        await execFileAsync(
            "tar",
            [
                "-xzf",
                backupPath,
                "-C",
                destination,
                "--no-same-owner",
                "--no-same-permissions"
            ],
            {
                timeout: 120000,
                maxBuffer: 5 * 1024 * 1024
            }
        );


        return {
            success: true,

            restore: {
                filename,
                destination,
                itemCount:
                    validation.entries.length,
                restoredAt:
                    new Date().toISOString()
            }
        };


    } catch (error) {

        // Failed restore cleanup
        try {
            await fs.rm(
                destination,
                {
                    recursive: true,
                    force: true
                }
            );
        } catch (_) {}


        console.error(
            "Restore error:",
            error.stderr || error.message
        );


        return {
            success: false,
            type: "restore-error",
            message:
                "Unable to restore backup"
        };
    }
}


async function deleteBackup(filename) {

    if (!isValidBackupFilename(filename)) {

        return {
            success: false,
            type: "invalid-filename",
            message:
                "Invalid backup filename"
        };
    }


    const backupPath =
        path.join(
            BACKUP_DIR,
            filename
        );


    try {

        const stats =
            await fs.lstat(backupPath);


        if (!stats.isFile()) {

            return {
                success: false,
                type: "not-found",
                message:
                    `Backup '${filename}' not found`
            };
        }


        await fs.unlink(backupPath);


        return {
            success: true,
            filename
        };


    } catch (error) {

        if (error.code === "ENOENT") {

            return {
                success: false,
                type: "not-found",
                message:
                    `Backup '${filename}' not found`
            };
        }

        throw error;
    }
}

module.exports = {
    createBackup,
    getBackups,
    getBackupByFilename,
    validateArchive,
    deleteBackup,
    restoreBackup
};