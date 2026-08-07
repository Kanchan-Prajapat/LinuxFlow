const sshService =
    require("../services/sshService");


async function getOverview(req, res) {

    try {

        const data =
            await sshService
                .getSshOverview();


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        console.error(
            "SSH overview error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve SSH information"
        });
    }
}

async function getSessions(req, res) {

    try {

        const data =
            await sshService
                .getActiveSshSessions();


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });


    } catch (error) {

        console.error(
            "SSH sessions error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve SSH sessions"
        });
    }
}


async function updateSetting(
    req,
    res
) {

    try {

        const {
            directive,
            value,
            confirmation
        } = req.body;


        const requiredConfirmation =
            `CHANGE SSH ${directive} ${value}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid SSH configuration confirmation",
                requiredConfirmation
            });
        }


        const result =
            await sshService
                .changeSshSetting(
                    directive,
                    value
                );


        if (!result.success) {

            const status =
                result.type === "unsupported" ||
                result.type === "invalid-value"
                    ? 400
                    : 409;


            return res.status(status).json({
                success: false,
                message:
                    result.message,
                error:
                    result.error || undefined
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `SSH setting '${directive}' updated successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "SSH configuration error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to update SSH configuration"
        });
    }
}

async function addPort(
    req,
    res
) {

    try {

        const {
            port,
            confirmation
        } = req.body;


        const requiredConfirmation =
            `ADD SSH PORT ${port}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid SSH port confirmation",
                requiredConfirmation
            });
        }


        const result =
            await sshService
                .addSshPort(port);


        if (!result.success) {

            let status = 409;

            if (
                result.type ===
                "invalid-port"
            ) {
                status = 400;
            }


            return res.status(status).json({
                success: false,
                message:
                    result.message,
                error:
                    result.error ||
                    undefined
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `SSH port ${port} added successfully`,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "SSH port error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to configure SSH port"
        });
    }
}



async function removePort(req, res) {

    try {

        const { port } = req.params;
        const { confirmation } = req.body;

        const requiredConfirmation =
            `REMOVE SSH PORT ${port}`;


        if (confirmation !== requiredConfirmation) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid SSH port removal confirmation",
                requiredConfirmation
            });
        }


        const result =
            await sshService.removeSshPort(
                port
            );


        if (!result.success) {

            const status =
                result.type === "invalid-port"
                    ? 400
                    : 409;


            return res.status(status).json({
                success: false,
                message: result.message,
                error:
                    result.error || undefined
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `SSH port ${port} removed successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "SSH port removal error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to remove SSH port"
        });
    }
}


module.exports = {
    getOverview,
    getSessions,
    updateSetting,
    addPort,
    removePort
};