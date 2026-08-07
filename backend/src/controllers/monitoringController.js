const monitoringService =
    require("../services/monitoringService");


async function getOverview(req, res) {

    try {

        const data =
            await monitoringService
                .getMonitoringOverview();


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        console.error(
            "Monitoring error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve monitoring information"
        });
    }
}


async function getProcesses(
    req,
    res
) {

    try {

        const {
            search,
            limit
        } = req.query;


        const data =
            await monitoringService
                .getProcesses({
                    search,
                    limit
                });


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });


    } catch (error) {

        console.error(
            "Process list error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve processes"
        });
    }
}


async function getProcessDetails(
    req,
    res
) {

    try {

        const result =
            await monitoringService
                .getProcessByPid(
                    req.params.pid
                );


        if (!result.success) {

            const status =
                result.type === "invalid-pid"
                    ? 400
                    : 404;


            return res.status(status).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Process details error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve process details"
        });
    }
}


async function terminateProcess(
    req,
    res
) {

    try {

        const { pid } =
            req.params;

        const { confirmation } =
            req.body;


        const requiredConfirmation =
            `TERMINATE PROCESS ${pid}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid process termination confirmation",
                requiredConfirmation
            });
        }


        const result =
            await monitoringService
                .terminateProcess(pid);


        if (!result.success) {

            let status = 409;

            if (
                result.type ===
                "invalid-pid"
            ) {
                status = 400;
            }

            if (
                result.type ===
                "not-found"
            ) {
                status = 404;
            }


            return res.status(status).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `SIGTERM sent to process ${pid}`,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Process termination error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to terminate process"
        });
    }
}


async function forceKillProcess(
    req,
    res
) {

    try {

        const { pid } =
            req.params;

        const { confirmation } =
            req.body;


        const requiredConfirmation =
            `KILL PROCESS ${pid}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid process kill confirmation",
                requiredConfirmation
            });
        }


        const result =
            await monitoringService
                .killProcess(pid);


        if (!result.success) {

            let status = 409;

            if (
                result.type ===
                "invalid-pid"
            ) {
                status = 400;
            }

            if (
                result.type ===
                "not-found"
            ) {
                status = 404;
            }


            return res.status(status).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `SIGKILL sent to process ${pid}`,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Process kill error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to kill process"
        });
    }
}

async function getAlerts(
    req,
    res
) {

    try {

        const data =
            await monitoringService
                .getMonitoringAlerts();


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        console.error(
            "Monitoring alerts error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve monitoring alerts"
        });
    }
}




module.exports = {
    getOverview,
    getProcesses,
    getProcessDetails,
      terminateProcess,
    forceKillProcess,
    getAlerts
};