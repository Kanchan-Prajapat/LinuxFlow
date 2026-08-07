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


module.exports = {
    getPhysicalVolumes,
    getVolumeGroups,
    getLogicalVolumes,
    getLvmOverview
};