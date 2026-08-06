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


module.exports = {
    getAcl
};