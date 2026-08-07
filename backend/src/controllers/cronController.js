const cronService =
    require("../services/cronService");


// ########################################################
// Cron Overview
// ########################################################

async function getOverview(
    req,
    res
) {

    try {

        const data =
            await cronService
                .getCronOverview();


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        console.error(
            "Cron overview error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve cron information"
        });
    }
}


async function getManagedJobs(
    req,
    res
) {

    try {

        const data =
            await cronService
                .getLinuxFlowCronJobs();


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });


    } catch (error) {

        console.error(
            "Managed cron jobs error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve LinuxFlow cron jobs"
        });
    }
}


async function createJob(
    req,
    res
) {

    try {

        const {
            name,
            schedule,
            command,
            confirmation
        } = req.body;


        const requiredConfirmation =
            `CREATE CRON ${name}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid cron creation confirmation",
                requiredConfirmation
            });
        }


        const result =
            await cronService
                .createCronJob({
                    name,
                    schedule,
                    command
                });


        if (!result.success) {

            return res.status(400).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(201).json({
            success: true,
            message:
                `Cron job '${name}' created successfully`,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Cron creation error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to create cron job"
        });
    }
}



async function setJobStatus(
    req,
    res
) {

    try {

        const { id } =
            req.params;

        const {
            enabled,
            confirmation
        } = req.body;


        if (typeof enabled !== "boolean") {

            return res.status(400).json({
                success: false,
                message:
                    "'enabled' must be true or false"
            });
        }


        const action =
            enabled
                ? "ENABLE"
                : "DISABLE";


        const requiredConfirmation =
            `${action} CRON ${id}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid cron status confirmation",
                requiredConfirmation
            });
        }


        const result =
            await cronService
                .setCronJobEnabled(
                    id,
                    enabled
                );


        if (!result.success) {

            return res.status(404).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `Cron job ${enabled ? "enabled" : "disabled"} successfully`,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Cron status error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to update cron job"
        });
    }
}


async function deleteJob(
    req,
    res
) {

    try {

        const { id } =
            req.params;

        const { confirmation } =
            req.body;


        const requiredConfirmation =
            `DELETE CRON ${id}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid cron deletion confirmation",
                requiredConfirmation
            });
        }


        const result =
            await cronService
                .deleteCronJob(id);


        if (!result.success) {

            return res.status(404).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `Cron job '${result.data.name}' deleted successfully`,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Cron deletion error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to delete cron job"
        });
    }
}





module.exports = {
    getOverview,
      getManagedJobs,
    createJob,
      setJobStatus,
    deleteJob
};