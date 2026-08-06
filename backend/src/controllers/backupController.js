const path = require("path");

const backupService =
    require("../services/backupService");


function validateSourcePath(sourcePath) {

    if (
        typeof sourcePath !== "string" ||
        sourcePath.trim() === ""
    ) {
        return false;
    }


    if (!path.posix.isAbsolute(sourcePath)) {
        return false;
    }


    if (sourcePath.includes("\0")) {
        return false;
    }


    return true;
}


async function createBackup(req, res) {

    try {

        const {
            sourcePath
        } = req.body;


        if (!validateSourcePath(sourcePath)) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid absolute Linux source path is required"
            });
        }


        const result =
            await backupService
                .createBackup(sourcePath);


        if (!result.success) {

            if (result.type === "not-found") {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            return res.status(500).json({
                success: false,
                message: result.message
            });
        }


        return res.status(201).json({
            success: true,
            message:
                "Backup created successfully",
            data: result.backup
        });


    } catch (error) {

        console.error(
            "Create backup error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to create backup"
        });
    }
}


async function getBackups(req, res) {

    try {

        const backups =
            await backupService.getBackups();


        return res.status(200).json({
            success: true,
            count: backups.length,
            data: backups
        });


    } catch (error) {

        console.error(
            "Backup list error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve backups"
        });
    }
}


async function getBackupByFilename(req, res) {

    try {

        const {
            filename
        } = req.params;


        if (
            !/^[a-zA-Z0-9._-]+\.tar\.gz$/
                .test(filename)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid backup filename"
            });
        }


        const backup =
            await backupService
                .getBackupByFilename(
                    filename
                );


        if (!backup) {

            return res.status(404).json({
                success: false,
                message:
                    `Backup '${filename}' not found`
            });
        }


        return res.status(200).json({
            success: true,
            data: backup
        });


    } catch (error) {

        console.error(
            "Backup details error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve backup information"
        });
    }
}


module.exports = {
    createBackup,
    getBackups,
    getBackupByFilename
};