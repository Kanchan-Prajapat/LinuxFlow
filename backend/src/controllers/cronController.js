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



module.exports = {
    getOverview,
      getManagedJobs,
    createJob
};