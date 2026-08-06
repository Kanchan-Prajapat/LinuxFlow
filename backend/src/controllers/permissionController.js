const path = require("path");

const permissionService =
    require("../services/permissionService");


function validatePath(targetPath) {

    if (
        typeof targetPath !== "string" ||
        targetPath.trim() === ""
    ) {
        return false;
    }

    // LinuxFlow backend manages Linux paths.
    // Require absolute paths.
    if (!path.posix.isAbsolute(targetPath)) {
        return false;
    }

    // Null bytes must never be accepted.
    if (targetPath.includes("\0")) {
        return false;
    }

    return true;
}


async function getPermissions(req, res) {

    try {

        const { path: targetPath } =
            req.query;


        if (!validatePath(targetPath)) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid absolute Linux path is required"
            });
        }


        const result =
            await permissionService
                .getPermissions(targetPath);


        if (!result.success) {

            if (result.type === "not-found") {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (
                result.type ===
                "permission-denied"
            ) {

                return res.status(403).json({
                    success: false,
                    message: result.message
                });
            }


            return res.status(500).json({
                success: false,
                message: result.message
            });
        }


        return res.status(200).json({
            success: true,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Permission inspection error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve path permissions"
        });
    }
}

async function changePermissions(req, res) {

    try {

        const {
            path: targetPath,
            mode
        } = req.body;


        if (!validatePath(targetPath)) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid absolute Linux path is required"
            });
        }


        if (
            typeof mode !== "string" ||
            !/^[0-7]{3,4}$/.test(mode)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Mode must be a valid octal permission such as 640, 755 or 0644"
            });
        }


        const result =
            await permissionService
                .changePermissions(
                    targetPath,
                    mode
                );


        if (!result.success) {

            if (result.type === "not-found") {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            if (
                result.type === "protected" ||
                result.type === "permission-denied"
            ) {
                return res.status(403).json({
                    success: false,
                    message: result.message
                });
            }

            return res.status(500).json({
                success: false,
                message: result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `Permissions changed to ${mode}`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Change permissions error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to change permissions"
        });
    }
}


async function changeOwnership(req, res) {

    try {

        const {
            path: targetPath,
            uid,
            gid
        } = req.body;


        if (!validatePath(targetPath)) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid absolute Linux path is required"
            });
        }


        if (
            !Number.isInteger(uid) ||
            uid < 0 ||
            !Number.isInteger(gid) ||
            gid < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "uid and gid must be non-negative integers"
            });
        }


        const result =
            await permissionService
                .changeOwnership(
                    targetPath,
                    uid,
                    gid
                );


        if (!result.success) {

            if (result.type === "not-found") {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (
                result.type === "protected" ||
                result.type === "permission-denied"
            ) {

                return res.status(403).json({
                    success: false,
                    message: result.message
                });
            }


            return res.status(500).json({
                success: false,
                message: result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                "Ownership changed successfully",
            data: result.data
        });


    } catch (error) {

        console.error(
            "Change ownership error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to change ownership"
        });
    }
}


module.exports = {
    getPermissions,
    changePermissions,
    changeOwnership
};