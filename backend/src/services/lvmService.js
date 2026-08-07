const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const fs = require("fs");

const {
    addFstabEntry,
    removeFstabEntry,
    findFstabEntry
} = require("../utils/fstab");

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


async function createVolumeGroup(name, device) {

    if (
        typeof name !== "string" ||
        !/^[a-zA-Z0-9_+.-]+$/.test(name)
    ) {
        return {
            success: false,
            type: "invalid-name",
            message: "Invalid volume group name"
        };
    }

    const pvs = await getPhysicalVolumes();

    const pv = pvs.find(
        item => item.name === device
    );

    if (!pv) {
        return {
            success: false,
            type: "pv-not-found",
            message: `Physical volume '${device}' not found`
        };
    }

    if (pv.volumeGroup) {
        return {
            success: false,
            type: "pv-in-use",
            message:
                `Physical volume '${device}' already belongs to volume group '${pv.volumeGroup}'`
        };
    }

    const existingVgs =
        await getVolumeGroups();

    if (
        existingVgs.some(
            vg => vg.name === name
        )
    ) {
        return {
            success: false,
            type: "exists",
            message:
                `Volume group '${name}' already exists`
        };
    }

    await runLvmCommand(
        "vgcreate",
        [name, device]
    );

    const vgs =
        await getVolumeGroups();

    const created =
        vgs.find(vg => vg.name === name);

    if (!created) {
        throw new Error(
            "VG_CREATION_VALIDATION_FAILED"
        );
    }

    return {
        success: true,
        data: created
    };
}


async function createLogicalVolume(
    volumeGroup,
    name,
    size
) {

    if (
        !/^[a-zA-Z0-9_+.-]+$/.test(
            volumeGroup
        ) ||
        !/^[a-zA-Z0-9_+.-]+$/.test(name)
    ) {
        return {
            success: false,
            type: "invalid-name",
            message:
                "Invalid volume group or logical volume name"
        };
    }

    // Allow simple sizes such as:
    // 512M, 1G, 2G
    if (
        typeof size !== "string" ||
        !/^[1-9][0-9]*(M|G)$/i.test(size)
    ) {
        return {
            success: false,
            type: "invalid-size",
            message:
                "Invalid logical volume size"
        };
    }

    const vgs =
        await getVolumeGroups();

    const vg =
        vgs.find(
            item =>
                item.name === volumeGroup
        );

    if (!vg) {
        return {
            success: false,
            type: "vg-not-found",
            message:
                `Volume group '${volumeGroup}' not found`
        };
    }

    const lvs =
        await getLogicalVolumes();

    if (
        lvs.some(
            lv =>
                lv.volumeGroup === volumeGroup &&
                lv.name === name
        )
    ) {
        return {
            success: false,
            type: "exists",
            message:
                `Logical volume '${name}' already exists`
        };
    }

    await runLvmCommand(
        "lvcreate",
        [
            "-L",
            size,
            "-n",
            name,
            volumeGroup,
            "-y"
        ]
    );

    const updated =
        await getLogicalVolumes();

    const created =
        updated.find(
            lv =>
                lv.volumeGroup === volumeGroup &&
                lv.name === name
        );

    if (!created) {
        throw new Error(
            "LV_CREATION_VALIDATION_FAILED"
        );
    }

    return {
        success: true,
        data: created
    };
}


// Reject mounted LV
try {

    const mounted =
        await runLvmCommand(
            "findmnt",
            [
                "-n",
                "-S",
                lv.path
            ]
        );


    if (mounted) {

        return {
            success: false,
            type: "mounted",
            message:
                "Logical volume is mounted. Unmount it before deletion."
        };
    }

} catch (_) {}


const fstabEntry =
    await findFstabEntry(
        lv.path
    );


if (fstabEntry) {

    return {
        success: false,
        type: "fstab-entry",
        message:
            "Logical volume still has an /etc/fstab entry. Remove its mount first."
    };
}


async function removeLogicalVolume(
    volumeGroup,
    name
) {

    const lvs =
        await getLogicalVolumes();

    const lv =
        lvs.find(
            item =>
                item.volumeGroup === volumeGroup &&
                item.name === name
        );

    if (!lv) {
        return {
            success: false,
            type: "not-found",
            message:
                `Logical volume '${name}' not found`
        };
    }

    await runLvmCommand(
        "lvremove",
        [
            "-y",
            `${volumeGroup}/${name}`
        ]
    );

    return {
        success: true
    };
}


async function removeVolumeGroup(name) {

    const vgs =
        await getVolumeGroups();

    const vg =
        vgs.find(
            item => item.name === name
        );

    if (!vg) {
        return {
            success: false,
            type: "not-found",
            message:
                `Volume group '${name}' not found`
        };
    }

    if (vg.logicalVolumeCount > 0) {
        return {
            success: false,
            type: "not-empty",
            message:
                "Volume group contains logical volumes"
        };
    }

    await runLvmCommand(
        "vgremove",
        ["-y", name]
    );

    return {
        success: true
    };
}


async function removePhysicalVolume(device) {

    const pvs =
        await getPhysicalVolumes();

    const pv =
        pvs.find(
            item => item.name === device
        );

    if (!pv) {
        return {
            success: false,
            type: "not-found",
            message:
                `Physical volume '${device}' not found`
        };
    }

    if (pv.volumeGroup) {
        return {
            success: false,
            type: "in-use",
            message:
                `Physical volume '${device}' still belongs to volume group '${pv.volumeGroup}'`
        };
    }

    await runLvmCommand(
        "pvremove",
        [
            "-y",
            device
        ]
    );

    return {
        success: true
    };
}



async function createFilesystem(
    volumeGroup,
    logicalVolume,
    filesystem
) {

    const allowedFilesystems =
        new Set([
            "xfs",
            "ext4"
        ]);


    if (
        !allowedFilesystems.has(
            filesystem
        )
    ) {

        return {
            success: false,
            type: "invalid-filesystem",
            message:
                "Only xfs and ext4 filesystems are supported"
        };
    }


    const lvs =
        await getLogicalVolumes();


    const lv =
        lvs.find(item =>
            item.volumeGroup === volumeGroup &&
            item.name === logicalVolume
        );


    if (!lv) {

        return {
            success: false,
            type: "not-found",
            message:
                "Logical volume not found"
        };
    }


    // Check existing filesystem
    let existingFilesystem = "";

    try {

        existingFilesystem =
            await runLvmCommand(
                "blkid",
                [
                    "-s",
                    "TYPE",
                    "-o",
                    "value",
                    lv.path
                ]
            );

    } catch (_) {

        existingFilesystem = "";
    }


    if (existingFilesystem.trim()) {

        return {
            success: false,
            type: "filesystem-exists",
            message:
                `Logical volume already contains '${existingFilesystem.trim()}' filesystem`
        };
    }


    const command =
        filesystem === "xfs"
            ? "mkfs.xfs"
            : "mkfs.ext4";


    await runLvmCommand(
        command,
        [
            lv.path
        ]
    );


    // Verify
    const detected =
        await runLvmCommand(
            "blkid",
            [
                "-s",
                "TYPE",
                "-o",
                "value",
                lv.path
            ]
        );


    if (
        detected.trim() !== filesystem
    ) {

        throw new Error(
            "FILESYSTEM_VALIDATION_FAILED"
        );
    }


    return {
        success: true,
        data: {
            device: lv.path,
            filesystem
        }
    };
}


async function mountLogicalVolume(
    volumeGroup,
    logicalVolume,
    mountPoint
) {

    // LinuxFlow-managed mount points only
    if (
        typeof mountPoint !== "string" ||
        !/^\/mnt\/linuxflow(?:_[a-zA-Z0-9_-]+)?$/
            .test(mountPoint)
    ) {

        return {
            success: false,
            type: "invalid-mount-point",
            message:
                "Mount point must use /mnt/linuxflow or /mnt/linuxflow_<name>"
        };
    }


    const lvs =
        await getLogicalVolumes();


    const lv =
        lvs.find(item =>
            item.volumeGroup === volumeGroup &&
            item.name === logicalVolume
        );


    if (!lv) {

        return {
            success: false,
            type: "not-found",
            message:
                "Logical volume not found"
        };
    }


    // Detect filesystem
    let filesystem;

    try {

        filesystem =
            await runLvmCommand(
                "blkid",
                [
                    "-s",
                    "TYPE",
                    "-o",
                    "value",
                    lv.path
                ]
            );

    } catch (_) {

        filesystem = "";
    }


    filesystem =
        filesystem.trim();


    if (!filesystem) {

        return {
            success: false,
            type: "no-filesystem",
            message:
                "Logical volume does not contain a filesystem"
        };
    }


    // Check if LV already mounted
    try {

        const mounted =
            await runLvmCommand(
                "findmnt",
                [
                    "-n",
                    "-S",
                    lv.path
                ]
            );


        if (mounted) {

            return {
                success: false,
                type: "already-mounted",
                message:
                    "Logical volume is already mounted"
            };
        }

    } catch (_) {
        // findmnt returns non-zero when not mounted
    }


    await fs.promises.mkdir(
        mountPoint,
        {
            recursive: true
        }
    );


    // Mount first.
    await runLvmCommand(
        "mount",
        [
            lv.path,
            mountPoint
        ]
    );


    try {

        // Add persistence only after successful mount.
        const fstabResult =
            await addFstabEntry({
                source: lv.path,
                target: mountPoint,
                filesystem,
                options: "defaults",
                dump: 0,
                pass:
                    filesystem === "ext4"
                        ? 2
                        : 0
            });


        if (!fstabResult.success) {

            // Roll back mount if persistence failed.
            try {
                await runLvmCommand(
                    "umount",
                    [mountPoint]
                );
            } catch (_) {}


            return fstabResult;
        }


        return {
            success: true,

            data: {
                device: lv.path,
                mountPoint,
                filesystem,
                persistent: true
            }
        };


    } catch (error) {

        try {
            await runLvmCommand(
                "umount",
                [mountPoint]
            );
        } catch (_) {}

        throw error;
    }
}



async function unmountLogicalVolume(
    volumeGroup,
    logicalVolume,
    removeDirectory = true
) {

    const lvs =
        await getLogicalVolumes();


    const lv =
        lvs.find(item =>
            item.volumeGroup === volumeGroup &&
            item.name === logicalVolume
        );


    if (!lv) {

        return {
            success: false,
            type: "not-found",
            message:
                "Logical volume not found"
        };
    }


    let mountPoint = null;


    try {

        mountPoint =
            await runLvmCommand(
                "findmnt",
                [
                    "-n",
                    "-o",
                    "TARGET",
                    "-S",
                    lv.path
                ]
            );

        mountPoint =
            mountPoint.trim();

    } catch (_) {

        mountPoint = null;
    }


    // Remove persistence entry first
    const fstabEntry =
        await findFstabEntry(
            lv.path
        );


    if (fstabEntry) {

        await removeFstabEntry(
            lv.path
        );
    }


    if (mountPoint) {

        await runLvmCommand(
            "umount",
            [mountPoint]
        );
    }


    if (
        removeDirectory &&
        mountPoint &&
        /^\/mnt\/linuxflow(?:_[a-zA-Z0-9_-]+)?$/
            .test(mountPoint)
    ) {

        try {

            await fs.promises.rmdir(
                mountPoint
            );

        } catch (_) {

            // Keep directory if not empty.
        }
    }


    return {
        success: true,
        data: {
            device: lv.path,
            mountPoint,
            persistentEntryRemoved:
                Boolean(fstabEntry)
        }
    };
}



module.exports = {
    getPhysicalVolumes,
    getVolumeGroups,
    getLogicalVolumes,
    getLvmOverview,
     inspectDevice,
    createPhysicalVolume,
    createVolumeGroup,
createLogicalVolume,
removeLogicalVolume,
removeVolumeGroup,
removePhysicalVolume,
createFilesystem,
mountLogicalVolume,
unmountLogicalVolume
};