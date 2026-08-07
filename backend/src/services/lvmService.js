const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);


async function runLvmCommand(
    command,
    args = []
) {

    try {

        const { stdout } =
            await execFileAsync(
                command,
                args,
                {
                    timeout: 15000,
                    maxBuffer:
                        5 * 1024 * 1024
                }
            );

        return stdout;

    } catch (error) {

        if (error.code === "ENOENT") {

            const err =
                new Error(
                    "LVM_COMMAND_MISSING"
                );

            err.command = command;

            throw err;
        }

        throw error;
    }
}


function cleanValue(value) {

    if (typeof value !== "string") {
        return value;
    }

    return value.trim();
}


async function getPhysicalVolumes() {

    const stdout =
        await runLvmCommand(
            "pvs",
            [
                "--reportformat",
                "json",

                "--units",
                "b",

                "--nosuffix",

                "-o",
                "pv_name,vg_name,pv_size,pv_free,pv_used"
            ]
        );


    const parsed =
        JSON.parse(stdout);


    const rows =
        parsed.report?.[0]?.pv || [];


    return rows.map(pv => ({

        name:
            cleanValue(pv.pv_name),

        volumeGroup:
            cleanValue(pv.vg_name) || null,

        sizeBytes:
            Number(
                cleanValue(pv.pv_size)
            ),

        freeBytes:
            Number(
                cleanValue(pv.pv_free)
            ),

        usedBytes:
            Number(
                cleanValue(pv.pv_used)
            )
    }));
}


async function getVolumeGroups() {

    const stdout =
        await runLvmCommand(
            "vgs",
            [
                "--reportformat",
                "json",

                "--units",
                "b",

                "--nosuffix",

                "-o",
                "vg_name,vg_size,vg_free,pv_count,lv_count"
            ]
        );


    const parsed =
        JSON.parse(stdout);


    const rows =
        parsed.report?.[0]?.vg || [];


    return rows.map(vg => ({

        name:
            cleanValue(vg.vg_name),

        sizeBytes:
            Number(
                cleanValue(vg.vg_size)
            ),

        freeBytes:
            Number(
                cleanValue(vg.vg_free)
            ),

        physicalVolumeCount:
            Number(
                cleanValue(vg.pv_count)
            ),

        logicalVolumeCount:
            Number(
                cleanValue(vg.lv_count)
            )
    }));
}


async function getLogicalVolumes() {

    const stdout =
        await runLvmCommand(
            "lvs",
            [
                "--reportformat",
                "json",

                "--units",
                "b",

                "--nosuffix",

                "-o",
                "lv_name,vg_name,lv_path,lv_size,lv_attr"
            ]
        );


    const parsed =
        JSON.parse(stdout);


    const rows =
        parsed.report?.[0]?.lv || [];


    return rows.map(lv => ({

        name:
            cleanValue(lv.lv_name),

        volumeGroup:
            cleanValue(lv.vg_name),

        path:
            cleanValue(lv.lv_path),

        sizeBytes:
            Number(
                cleanValue(lv.lv_size)
            ),

        attributes:
            cleanValue(lv.lv_attr)
    }));
}


async function getLvmOverview() {

    const [
        physicalVolumes,
        volumeGroups,
        logicalVolumes
    ] = await Promise.all([

        getPhysicalVolumes(),
        getVolumeGroups(),
        getLogicalVolumes()
    ]);


    const totalPhysicalBytes =
        physicalVolumes.reduce(
            (total, pv) =>
                total + pv.sizeBytes,
            0
        );


    const freePhysicalBytes =
        physicalVolumes.reduce(
            (total, pv) =>
                total + pv.freeBytes,
            0
        );


    return {

        physicalVolumes: {
            count:
                physicalVolumes.length,

            totalBytes:
                totalPhysicalBytes,

            freeBytes:
                freePhysicalBytes
        },


        volumeGroups: {
            count:
                volumeGroups.length
        },


        logicalVolumes: {
            count:
                logicalVolumes.length
        }
    };
}


async function inspectDevice(device) {

    // Only normal Linux block-device paths allowed
    if (
        typeof device !== "string" ||
        !/^\/dev\/[a-zA-Z0-9._/-]+$/.test(device)
    ) {
        return {
            safe: false,
            reason: "Invalid device path"
        };
    }


    // Get device information
    let stdout;

    try {

        const result =
            await execFileAsync(
                "lsblk",
                [
                    "-J",
                    "-o",
                    "NAME,PATH,TYPE,FSTYPE,MOUNTPOINTS",
                    device
                ],
                {
                    timeout: 10000
                }
            );

        stdout = result.stdout;

    } catch (error) {

        return {
            safe: false,
            reason:
                "Device does not exist or cannot be inspected"
        };
    }


    const parsed =
        JSON.parse(stdout);

    const block =
        parsed.blockdevices?.[0];


    if (!block) {

        return {
            safe: false,
            reason:
                "Device not found"
        };
    }


    // Require a whole disk
    if (block.type !== "disk") {

        return {
            safe: false,
            reason:
                "Only whole disks can be initialized as LinuxFlow physical volumes"
        };
    }


    // Reject filesystem
    if (block.fstype) {

        return {
            safe: false,
            reason:
                `Device contains filesystem/signature '${block.fstype}'`
        };
    }


    // Reject mounted disk
    if (
        Array.isArray(block.mountpoints) &&
        block.mountpoints.some(Boolean)
    ) {

        return {
            safe: false,
            reason:
                "Device is currently mounted"
        };
    }


    // Reject disks with partitions / LVM children
    if (
        Array.isArray(block.children) &&
        block.children.length > 0
    ) {

        return {
            safe: false,
            reason:
                "Device contains partitions or existing storage mappings"
        };
    }


    // Check whether already an LVM PV
    const pvs =
        await getPhysicalVolumes();


    const existingPv =
        pvs.some(
            pv => pv.name === device
        );


    if (existingPv) {

        return {
            safe: false,
            reason:
                "Device is already an LVM physical volume"
        };
    }


    // Check filesystem/signature using wipefs
    const wipeResult =
        await execFileAsync(
            "wipefs",
            [
                "-n",
                device
            ],
            {
                timeout: 10000
            }
        );


    if (wipeResult.stdout.trim()) {

        return {
            safe: false,
            reason:
                "Device contains an existing disk signature"
        };
    }


    return {
        safe: true,
        device
    };
}



async function createPhysicalVolume(
    device
) {

    const inspection =
        await inspectDevice(device);


    if (!inspection.safe) {

        return {
            success: false,
            type: "unsafe-device",
            message: inspection.reason
        };
    }


    await runLvmCommand(
        "pvcreate",
        [
            "--yes",
            device
        ]
    );


    // Verify creation
    const pvs =
        await getPhysicalVolumes();


    const created =
        pvs.find(
            pv => pv.name === device
        );


    if (!created) {

        throw new Error(
            "PV_CREATION_VALIDATION_FAILED"
        );
    }


    return {
        success: true,
        data: created
    };
}

module.exports = {
    getPhysicalVolumes,
    getVolumeGroups,
    getLogicalVolumes,
    getLvmOverview,
     inspectDevice,
    createPhysicalVolume
};