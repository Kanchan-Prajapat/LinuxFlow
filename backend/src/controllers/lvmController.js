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


async function inspectDevice(req, res) {

    try {

        const {
            device
        } = req.body;


        if (
            typeof device !== "string" ||
            !device.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Device path is required"
            });
        }


        const data =
            await lvmService
                .inspectDevice(device);


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to inspect LVM device"
        );
    }
}


async function createPhysicalVolume(
    req,
    res
) {

    try {

        const {
            device,
            confirmation
        } = req.body;


        const requiredConfirmation =
            `CREATE PV ${device}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid physical volume creation confirmation",
                requiredConfirmation
            });
        }


        const result =
            await lvmService
                .createPhysicalVolume(
                    device
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
                `Physical volume '${device}' created successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Create PV error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to create physical volume"
        });
    }
}


async function createVolumeGroup(req, res) {

    try {

        const {
            name,
            device,
            confirmation
        } = req.body;

        const requiredConfirmation =
            `CREATE VG ${name}`;

        if (
            confirmation !==
            requiredConfirmation
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid volume group creation confirmation",
                requiredConfirmation
            });
        }

        const result =
            await lvmService
                .createVolumeGroup(
                    name,
                    device
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
                `Volume group '${name}' created successfully`,
            data: result.data
        });

    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to create volume group"
        );
    }
}


async function createLogicalVolume(req, res) {

    try {

        const {
            volumeGroup,
            name,
            size,
            confirmation
        } = req.body;

        const requiredConfirmation =
            `CREATE LV ${volumeGroup}/${name}`;

        if (
            confirmation !==
            requiredConfirmation
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid logical volume creation confirmation",
                requiredConfirmation
            });
        }

        const result =
            await lvmService
                .createLogicalVolume(
                    volumeGroup,
                    name,
                    size
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
                `Logical volume '${name}' created successfully`,
            data: result.data
        });

    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to create logical volume"
        );
    }
}


async function removeLogicalVolume(req, res) {

    try {

        const {
            volumeGroup,
            name,
            confirmation
        } = req.body;

        const requiredConfirmation =
            `DELETE LV ${volumeGroup}/${name}`;

        if (confirmation !== requiredConfirmation) {
            return res.status(400).json({
                success: false,
                message: "Invalid deletion confirmation",
                requiredConfirmation
            });
        }

        const result =
            await lvmService
                .removeLogicalVolume(
                    volumeGroup,
                    name
                );

        if (!result.success) {
            return res.status(409).json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            message:
                `Logical volume '${name}' removed successfully`
        });

    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to remove logical volume"
        );
    }
}


async function removeVolumeGroup(req, res) {

    try {

        const {
            name,
            confirmation
        } = req.body;

        const requiredConfirmation =
            `DELETE VG ${name}`;

        if (confirmation !== requiredConfirmation) {
            return res.status(400).json({
                success: false,
                message: "Invalid deletion confirmation",
                requiredConfirmation
            });
        }

        const result =
            await lvmService
                .removeVolumeGroup(name);

        if (!result.success) {
            return res.status(409).json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            message:
                `Volume group '${name}' removed successfully`
        });

    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to remove volume group"
        );
    }
}


async function removePhysicalVolume(req, res) {

    try {

        const {
            device,
            confirmation
        } = req.body;

        const requiredConfirmation =
            `DELETE PV ${device}`;

        if (confirmation !== requiredConfirmation) {
            return res.status(400).json({
                success: false,
                message: "Invalid deletion confirmation",
                requiredConfirmation
            });
        }

        const result =
            await lvmService
                .removePhysicalVolume(device);

        if (!result.success) {
            return res.status(409).json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            message:
                `Physical volume '${device}' removed successfully`
        });

    } catch (error) {

        return handleError(
            res,
            error,
            "Unable to remove physical volume"
        );
    }
}


module.exports = {
    getOverview,
    getPhysicalVolumes,
    getVolumeGroups,
    getLogicalVolumes,
    inspectDevice,
    createPhysicalVolume,
    createVolumeGroup,
createLogicalVolume,
removeLogicalVolume,
removeVolumeGroup,
removePhysicalVolume

};