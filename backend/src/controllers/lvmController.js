const lvmService =
    require("../services/lvmService");


function handleError(
    res,
    error,
    message
) {

    console.error(
        "LVM API error:",
        error
    );


    if (
        error.message ===
        "LVM_COMMAND_MISSING"
    ) {

        return res.status(503).json({
            success: false,
            message:
                `Required LVM command '${error.command}' is not installed`
        });
    }


    return res.status(500).json({
        success: false,
        message
    });
}


async function getOverview(req, res) {

    try {

        const data =
            await lvmService
                .getLvmOverview();


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to retrieve LVM overview"
        );
    }
}


async function getPhysicalVolumes(
    req,
    res
) {

    try {

        const data =
            await lvmService
                .getPhysicalVolumes();


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });


    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to retrieve physical volumes"
        );
    }
}


async function getVolumeGroups(
    req,
    res
) {

    try {

        const data =
            await lvmService
                .getVolumeGroups();


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });


    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to retrieve volume groups"
        );
    }
}


async function getLogicalVolumes(
    req,
    res
) {

    try {

        const data =
            await lvmService
                .getLogicalVolumes();


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });


    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to retrieve logical volumes"
        );
    }
}


module.exports = {
    getOverview,
    getPhysicalVolumes,
    getVolumeGroups,
    getLogicalVolumes
};