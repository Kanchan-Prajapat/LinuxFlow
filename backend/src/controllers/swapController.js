const swapService =
    require("../services/swapService");


async function getSwap(req, res) {

    try {

        const data =
            await swapService
                .getSwapInfo();


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });


    } catch (error) {

        console.error(
            "Swap read error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve swap information"
        });
    }
}


async function createSwap(req, res) {

    try {

        const {
            path,
            sizeMB,
            confirmation
        } = req.body;


        const requiredConfirmation =
            `CREATE SWAP ${path}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid swap creation confirmation",
                requiredConfirmation
            });
        }


        const result =
            await swapService
                .createSwapFile(
                    path,
                    sizeMB
                );


        if (!result.success) {

            return res.status(409).json({
                success: false,
                message: result.message
            });
        }


        return res.status(201).json({
            success: true,
            message:
                `Swap file '${path}' created, enabled and persisted successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Create swap error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to create swap file"
        });
    }
}


async function removeSwap(req, res) {

    try {

        const {
            path,
            confirmation
        } = req.body;


        const requiredConfirmation =
            `DELETE SWAP ${path}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid swap deletion confirmation",
                requiredConfirmation
            });
        }


        const result =
            await swapService
                .removeSwapFile(path);


        if (!result.success) {

            const status =
                result.type === "protected"
                    ? 403
                    : result.type === "not-found"
                        ? 404
                        : 409;


            return res.status(status).json({
                success: false,
                message: result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `Swap file '${path}' disabled and removed successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Remove swap error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to remove swap file"
        });
    }
}


module.exports = {
    getSwap,
    createSwap,
    removeSwap
};