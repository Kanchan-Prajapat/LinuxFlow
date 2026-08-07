const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const crypto = require("crypto");

const LINUXFLOW_CRON_FILE =
    "/etc/cron.d/linuxflow";

const LINUXFLOW_TAG =
    "LINUXFLOW";
// ########################################################
// Command Helper
// ########################################################

async function runCommand(
    command,
    args = []
) {

    const { stdout } =
        await execFileAsync(
            command,
            args,
            {
                timeout: 10000,
                maxBuffer: 5 * 1024 * 1024
            }
        );

    return stdout.trim();
}


// ########################################################
// Parse Crontab
// ########################################################

function parseCrontab(content) {

    if (!content) {
        return [];
    }


    const jobs = [];


    for (const line of content.split("\n")) {

        const trimmed =
            line.trim();


        // Ignore blank lines
        if (!trimmed) {
            continue;
        }


        // Ignore comments
        if (trimmed.startsWith("#")) {
            continue;
        }


        // Ignore environment variables such as:
        // SHELL=/bin/bash
        // PATH=/usr/bin:/bin

        if (
            /^[A-Za-z_][A-Za-z0-9_]*=/.test(
                trimmed
            )
        ) {
            continue;
        }


        // Handle @reboot, @daily etc.
        if (trimmed.startsWith("@")) {

            const firstSpace =
                trimmed.indexOf(" ");


            if (firstSpace === -1) {
                continue;
            }


            jobs.push({
                schedule:
                    trimmed.slice(
                        0,
                        firstSpace
                    ),

                command:
                    trimmed.slice(
                        firstSpace + 1
                    ).trim(),

                type:
                    "special"
            });


            continue;
        }


        const parts =
            trimmed.split(/\s+/);


        // Standard cron requires:
        //
        // minute hour day month weekday command
        if (parts.length < 6) {
            continue;
        }


        jobs.push({

            schedule:
                parts
                    .slice(0, 5)
                    .join(" "),

            command:
                parts
                    .slice(5)
                    .join(" "),

            type:
                "standard"
        });
    }


    return jobs;
}


// ########################################################
// Current User Crontab
// ########################################################

async function getCurrentUserCronJobs() {

    let stdout = "";


    try {

        stdout =
            await runCommand(
                "crontab",
                ["-l"]
            );

    } catch (error) {

        /*
         * crontab -l returns non-zero when
         * user has no crontab.
         */

        const stderr =
            error.stderr || "";


        if (
            stderr
                .toLowerCase()
                .includes(
                    "no crontab"
                )
        ) {

            return [];
        }


        throw error;
    }


    return parseCrontab(
        stdout
    );
}


// ########################################################
// Cron Service Status
// ########################################################

async function getCronServiceStatus() {

    let active = false;
    let enabled = false;


    try {

        const status =
            await runCommand(
                "systemctl",
                [
                    "is-active",
                    "crond"
                ]
            );

        active =
            status === "active";

    } catch (_) {}


    try {

        const status =
            await runCommand(
                "systemctl",
                [
                    "is-enabled",
                    "crond"
                ]
            );

        enabled =
            status === "enabled";

    } catch (_) {}


    return {
        service:
            "crond",

        active,
        enabled
    };
}


// ########################################################
// System Cron Directories
// ########################################################

async function getSystemCronInfo() {

    const locations = [
        "/etc/cron.d",
        "/etc/cron.hourly",
        "/etc/cron.daily",
        "/etc/cron.weekly",
        "/etc/cron.monthly"
    ];


    const result = [];


    for (const location of locations) {

        try {

            const entries =
                await fs.promises.readdir(
                    location
                );


            result.push({
                location,
                exists: true,
                count:
                    entries.length
            });


        } catch (_) {

            result.push({
                location,
                exists: false,
                count: 0
            });
        }
    }


    return result;
}


// ########################################################
// Cron Overview
// ########################################################

async function getCronOverview() {

    const [
        status,
        jobs,
        systemLocations
    ] =
        await Promise.all([
            getCronServiceStatus(),
            getCurrentUserCronJobs(),
            getSystemCronInfo()
        ]);


    return {

        status,

        currentUser: {
            jobsCount:
                jobs.length,

            jobs
        },

        systemLocations
    };
}


// ########################################################
// Cron Schedule Validation
// ########################################################

const SPECIAL_SCHEDULES = new Set([
    "@reboot",
    "@hourly",
    "@daily",
    "@weekly",
    "@monthly",
    "@yearly",
    "@annually"
]);


function validateCronSchedule(schedule) {

    if (
        typeof schedule !== "string" ||
        !schedule.trim()
    ) {
        return {
            valid: false,
            message: "Cron schedule is required"
        };
    }


    const value =
        schedule.trim();


    if (value.startsWith("@")) {

        if (!SPECIAL_SCHEDULES.has(value)) {

            return {
                valid: false,
                message:
                    `Unsupported special cron schedule '${value}'`
            };
        }


        return {
            valid: true,
            schedule: value
        };
    }


    const fields =
        value.split(/\s+/);


    if (fields.length !== 5) {

        return {
            valid: false,
            message:
                "Standard cron schedule must contain exactly 5 fields"
        };
    }


    /*
     * Basic character validation.
     *
     * Detailed semantic validation can later
     * be added separately.
     */

    const allowed =
        /^[0-9*/,\-]+$/;


    for (const field of fields) {

        if (!allowed.test(field)) {

            return {
                valid: false,
                message:
                    `Invalid cron schedule field '${field}'`
            };
        }
    }


    return {
        valid: true,
        schedule: value
    };
}


// ########################################################
// Cron Command Validation
// ########################################################

function validateCronCommand(command) {

    if (
        typeof command !== "string" ||
        !command.trim()
    ) {

        return {
            valid: false,
            message:
                "Cron command is required"
        };
    }


    if (
        command.includes("\n") ||
        command.includes("\r") ||
        command.includes("\0")
    ) {

        return {
            valid: false,
            message:
                "Cron command contains invalid characters"
        };
    }


    const trimmed =
        command.trim();


    if (trimmed.length > 1000) {

        return {
            valid: false,
            message:
                "Cron command is too long"
        };
    }


    return {
        valid: true,
        command: trimmed
    };
}


// ########################################################
// LinuxFlow Cron File
// ########################################################

async function ensureLinuxFlowCronFile() {

    try {

        await fs.promises.access(
            LINUXFLOW_CRON_FILE
        );

    } catch (_) {

        await fs.promises.writeFile(
            LINUXFLOW_CRON_FILE,
            "# Managed by LinuxFlow\n",
            {
                mode: 0o600
            }
        );
    }


    await fs.promises.chmod(
        LINUXFLOW_CRON_FILE,
        0o600
    );
}


async function readLinuxFlowCronFile() {

    await ensureLinuxFlowCronFile();


    return await fs.promises.readFile(
        LINUXFLOW_CRON_FILE,
        "utf8"
    );
}


// ########################################################
// Parse LinuxFlow Managed Jobs
// ########################################################

function parseLinuxFlowJobs(content) {

    const lines =
        content.split("\n");


    const jobs = [];


    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i].trim();


        if (
            !line.startsWith(
                `# ${LINUXFLOW_TAG}:`
            )
        ) {
            continue;
        }


        const metadata =
            line.slice(
                `# ${LINUXFLOW_TAG}:`.length
            );


        const values = {};


        for (
            const pair of
            metadata.split(";")
        ) {

            const separator =
                pair.indexOf("=");


            if (separator === -1) {
                continue;
            }


            const key =
                pair
                    .slice(0, separator)
                    .trim();

            const value =
                pair
                    .slice(separator + 1)
                    .trim();


            values[key] = value;
        }


        const cronLine =
            lines[i + 1] || "";


        if (!cronLine.trim()) {
            continue;
        }


        const enabled =
            values.enabled === "true";


       const normalizedLine =
    cronLine
        .replace(
            /^\s*#\s*LINUXFLOW-DISABLED\s+/,
            ""
        )
        .trim();


        jobs.push({
            id:
                values.id,

            name:
                values.name,

            enabled,

            cronLine:
                normalizedLine
        });
    }


    return jobs;
}


// ########################################################
// Create LinuxFlow Cron Job
// ########################################################

async function createCronJob({
    name,
    schedule,
    command
}) {

    if (
        typeof name !== "string" ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(name)
    ) {

        return {
            success: false,
            type: "invalid-name",
            message:
                "Cron job name may contain only letters, numbers, '_' and '-'"
        };
    }


    const scheduleValidation =
        validateCronSchedule(schedule);


    if (!scheduleValidation.valid) {

        return {
            success: false,
            type: "invalid-schedule",
            message:
                scheduleValidation.message
        };
    }


    const commandValidation =
        validateCronCommand(command);


    if (!commandValidation.valid) {

        return {
            success: false,
            type: "invalid-command",
            message:
                commandValidation.message
        };
    }


    const content =
        await readLinuxFlowCronFile();


    const existing =
        parseLinuxFlowJobs(content);


    if (
        existing.some(
            job => job.name === name
        )
    ) {

        return {
            success: false,
            type: "duplicate-name",
            message:
                `Cron job '${name}' already exists`
        };
    }


    const id =
        crypto.randomBytes(8)
            .toString("hex");


    const cronLine =
        scheduleValidation.schedule
            .startsWith("@")

            ? `${scheduleValidation.schedule} root ${commandValidation.command}`

            : `${scheduleValidation.schedule} root ${commandValidation.command}`;


    const block =
        [
            "",
            `# ${LINUXFLOW_TAG}:id=${id};name=${name};enabled=true`,
            cronLine,
            ""
        ].join("\n");


    await fs.promises.appendFile(
        LINUXFLOW_CRON_FILE,
        block,
        "utf8"
    );


    return {
        success: true,

        data: {
            id,
            name,
            schedule:
                scheduleValidation.schedule,
            command:
                commandValidation.command,
            enabled: true
        }
    };
}


async function getLinuxFlowCronJobs() {

    const content =
        await readLinuxFlowCronFile();


    return parseLinuxFlowJobs(
        content
    );
}


// ########################################################
// Update LinuxFlow Managed Cron Job
// ########################################################

async function setCronJobEnabled(
    id,
    enabled
) {

    const content =
        await readLinuxFlowCronFile();

    const lines =
        content.split("\n");

    let found = false;


    for (let i = 0; i < lines.length; i++) {

        const metadataLine =
            lines[i].trim();

        if (
            !metadataLine.startsWith(
                `# ${LINUXFLOW_TAG}:`
            )
        ) {
            continue;
        }


        const metadata =
            metadataLine.slice(
                `# ${LINUXFLOW_TAG}:`.length
            );

        const values = {};

        for (const pair of metadata.split(";")) {

            const separator =
                pair.indexOf("=");

            if (separator === -1) {
                continue;
            }

            const key =
                pair
                    .slice(0, separator)
                    .trim();

            const value =
                pair
                    .slice(separator + 1)
                    .trim();

            values[key] = value;
        }


        if (values.id !== id) {
            continue;
        }


        found = true;


        // Update metadata
        values.enabled =
            enabled ? "true" : "false";


        lines[i] =
            `# ${LINUXFLOW_TAG}:id=${values.id};name=${values.name};enabled=${values.enabled}`;


        // Next line is the actual cron job.
        if (i + 1 >= lines.length) {

            return {
                success: false,
                type: "invalid-job",
                message:
                    `Cron job '${id}' has no cron command`
            };
        }


        if (enabled) {

            // Remove ONLY LinuxFlow's disable marker.
            lines[i + 1] =
                lines[i + 1]
                    .replace(
                        /^\s*#\s*LINUXFLOW-DISABLED\s+/,
                        ""
                    );

        } else {

            if (
                !lines[i + 1]
                    .trim()
                    .startsWith(
                        "# LINUXFLOW-DISABLED "
                    )
            ) {

                lines[i + 1] =
                    `# LINUXFLOW-DISABLED ${lines[i + 1]}`;
            }
        }


        break;
    }


    if (!found) {

        return {
            success: false,
            type: "not-found",
            message:
                `LinuxFlow cron job '${id}' not found`
        };
    }


    await fs.promises.writeFile(
        LINUXFLOW_CRON_FILE,
        lines.join("\n"),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );


    return {
        success: true,

        data: {
            id,
            enabled
        }
    };
}

// ########################################################
// Delete LinuxFlow Managed Cron Job
// ########################################################

async function deleteCronJob(id) {

    const content =
        await readLinuxFlowCronFile();

    const lines =
        content.split("\n");

    let metadataIndex = -1;
    let jobName = null;


    for (let i = 0; i < lines.length; i++) {

        const line =
            lines[i].trim();

        if (
            !line.startsWith(
                `# ${LINUXFLOW_TAG}:`
            )
        ) {
            continue;
        }


        const metadata =
            line.slice(
                `# ${LINUXFLOW_TAG}:`.length
            );


        const values = {};

        for (const pair of metadata.split(";")) {

            const separator =
                pair.indexOf("=");

            if (separator === -1) {
                continue;
            }

            const key =
                pair.slice(
                    0,
                    separator
                ).trim();

            const value =
                pair.slice(
                    separator + 1
                ).trim();

            values[key] = value;
        }


        if (values.id === id) {

            metadataIndex = i;
            jobName = values.name;

            break;
        }
    }


    if (metadataIndex === -1) {

        return {
            success: false,
            type: "not-found",
            message:
                `LinuxFlow cron job '${id}' not found`
        };
    }


    /*
     * Remove:
     *
     * metadata line
     * +
     * associated cron command line
     */

    lines.splice(
        metadataIndex,
        2
    );


    await fs.promises.writeFile(
        LINUXFLOW_CRON_FILE,
        lines.join("\n"),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );


    return {
        success: true,

        data: {
            id,
            name: jobName
        }
    };
}





module.exports = {
    parseCrontab,
    getCurrentUserCronJobs,
    getCronServiceStatus,
    getSystemCronInfo,
    getCronOverview,

    validateCronSchedule,
    validateCronCommand,
    getLinuxFlowCronJobs,
    createCronJob,
       setCronJobEnabled,
    deleteCronJob
};