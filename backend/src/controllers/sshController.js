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


module.exports = {
    getOverview,
    getSessions,
    updateSetting
};