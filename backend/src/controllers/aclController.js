const path = require("path");

const aclService =
    require("../services/aclService");


function validatePath(targetPath) {

    if (
        typeof targetPath !== "string" ||
        targetPath.trim() === ""
    ) {
        return false;
    }


    if (!path.posix.isAbsolute(targetPath)) {
        return false;
    }


    if (targetPath.includes("\0")) {
        return false;
    }


    return true;
}


function validateAccountName(name) {

    return (
        typeof name === "string" &&
        /^[a-z_][a-z0-9_-]{0,31}$/.test(name)
    );
}


function validateAclPermissions(permissions) {

    return (
        typeof permissions === "string" &&
        /^[r-][w-][x-]$/.test(permissions)
    );
}

async function getAcl(req, res) {

    try {

        const {
            path: targetPath
        } = req.query;


        if (!validatePath(targetPath)) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid absolute Linux path is required"
            });
        }


        const result =
            await aclService.getAcl(
                targetPath
            );


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


            if (
                result.type ===
                "command-missing"
            ) {

                return res.status(503).json({
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
            "ACL inspection error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve ACL information"
        });
    }
}

async function setUserAcl(req, res) {

    try {

        const {
            path: targetPath,
            username,
            permissions
        } = req.body;


        if (!validatePath(targetPath)) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid absolute Linux path is required"
            });
        }


        if (!validateAccountName(username)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid username"
            });
        }


        if (!validateAclPermissions(permissions)) {

            return res.status(400).json({
                success: false,
                message:
                    "ACL permissions must use rwx format such as rw-, r-- or rwx"
            });
        }


        const result =
            await aclService.setUserAcl(
                targetPath,
                username,
                permissions
            );


        return handleAclWriteResult(
            res,
            result,
            `ACL updated for user '${username}'`
        );


    } catch (error) {

        console.error(
            "Set user ACL error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update user ACL"
        });
    }
}


async function setGroupAcl(req, res) {

    try {

        const {
            path: targetPath,
            groupName,
            permissions
        } = req.body;


        if (
            !validatePath(targetPath) ||
            !validateAccountName(groupName)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid path or group name"
            });
        }


        if (!validateAclPermissions(permissions)) {

            return res.status(400).json({
                success: false,
                message:
                    "ACL permissions must use rwx format"
            });
        }


        const result =
            await aclService.setGroupAcl(
                targetPath,
                groupName,
                permissions
            );


        return handleAclWriteResult(
            res,
            result,
            `ACL updated for group '${groupName}'`
        );


    } catch (error) {

        console.error(
            "Set group ACL error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update group ACL"
        });
    }
}



function handleAclWriteResult(
    res,
    result,
    successMessage
) {

    if (result.success) {

        return res.status(200).json({
            success: true,
            message: successMessage,
            data: result.data
        });
    }


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


    if (result.type === "command-missing") {

        return res.status(503).json({
            success: false,
            message: result.message
        });
    }


    return res.status(500).json({
        success: false,
        message: result.message
    });
}



async function removeUserAcl(req, res) {

    try {

        const {
            path: targetPath,
            username
        } = req.body;


        if (
            !validatePath(targetPath) ||
            !validateAccountName(username)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid path or username"
            });
        }


        const result =
            await aclService.removeUserAcl(
                targetPath,
                username
            );


        return handleAclWriteResult(
            res,
            result,
            `ACL removed for user '${username}'`
        );


    } catch (error) {

        console.error(
            "Remove user ACL error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to remove user ACL"
        });
    }
}


async function removeGroupAcl(req, res) {

    try {

        const {
            path: targetPath,
            groupName
        } = req.body;


        if (
            !validatePath(targetPath) ||
            !validateAccountName(groupName)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid path or group name"
            });
        }


        const result =
            await aclService.removeGroupAcl(
                targetPath,
                groupName
            );


        return handleAclWriteResult(
            res,
            result,
            `ACL removed for group '${groupName}'`
        );


    } catch (error) {

        console.error(
            "Remove group ACL error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to remove group ACL"
        });
    }
}


async function removeAllAcl(req, res) {

    try {

        const {
            path: targetPath
        } = req.body;


        if (!validatePath(targetPath)) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid absolute Linux path is required"
            });
        }


        const result =
            await aclService
                .removeAllExtendedAcl(
                    targetPath
                );


        return handleAclWriteResult(
            res,
            result,
            "Extended ACL entries removed successfully"
        );


    } catch (error) {

        console.error(
            "Remove all ACL error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to remove extended ACL entries"
        });
    }
}



module.exports = {
    getAcl,
    setUserAcl,
    setGroupAcl,
    removeUserAcl,
    removeGroupAcl,
    removeAllAcl
};