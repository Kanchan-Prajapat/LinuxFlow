const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const SSH_CONFIG =
    "/etc/ssh/sshd_config";

const SSH_BACKUP =
    "/etc/ssh/sshd_config.linuxflow.bak";

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
// SSH Service Status
// ########################################################

async function getSshStatus() {

    let active = false;
    let enabled = false;


    try {

        const status =
            await runCommand(
                "systemctl",
                [
                    "is-active",
                    "sshd"
                ]
            );

        active =
            status === "active";

    } catch (_) {

        active = false;
    }


    try {

        const status =
            await runCommand(
                "systemctl",
                [
                    "is-enabled",
                    "sshd"
                ]
            );

        enabled =
            status === "enabled";

    } catch (_) {

        enabled = false;
    }


    return {
        service: "sshd",
        active,
        enabled
    };
}


// ########################################################
// Read effective SSH configuration
// ########################################################

async function getSshConfiguration() {

    const stdout =
        await runCommand(
            "sshd",
            ["-T"]
        );


    const config = {};


    for (
        const line of stdout.split("\n")
    ) {

        const trimmed =
            line.trim();

        if (!trimmed) {
            continue;
        }


        const firstSpace =
            trimmed.indexOf(" ");


        if (firstSpace === -1) {
            continue;
        }


        const key =
            trimmed
                .slice(0, firstSpace)
                .trim();


        const value =
            trimmed
                .slice(firstSpace + 1)
                .trim();


        config[key] = value;
    }


    return {
        port:
            Number(config.port),

        permitRootLogin:
            config.permitrootlogin,

        passwordAuthentication:
            config.passwordauthentication,

        pubkeyAuthentication:
            config.pubkeyauthentication,

        maxAuthTries:
            Number(config.maxauthtries),

        maxSessions:
            Number(config.maxsessions),

        clientAliveInterval:
            Number(config.clientaliveinterval),

        clientAliveCountMax:
            Number(config.clientalivecountmax)
    };
}


// ########################################################
// SSH Overview
// ########################################################

async function getSshOverview() {

    const [
        status,
        configuration
    ] =
        await Promise.all([
            getSshStatus(),
            getSshConfiguration()
        ]);


    return {

        status,

        configuration,

        configFile:
            SSH_CONFIG
    };
}

// ########################################################
// Active SSH Sessions
// ########################################################

async function getActiveSshSessions() {

    let stdout = "";

    try {

        stdout =
            await runCommand(
                "who",
                []
            );

    } catch (_) {

        return [];
    }


    if (!stdout) {
        return [];
    }


    const sessions = [];


    for (const line of stdout.split("\n")) {

        const trimmed =
            line.trim();

        if (!trimmed) {
            continue;
        }


        /*
         * Typical:
         *
         * root pts/0 2026-08-07 21:30 (192.168.1.10)
         */

        const match =
            trimmed.match(
                /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+\(([^)]+)\))?/
            );


        if (!match) {
            continue;
        }


        const [
            ,
            username,
            terminal,
            loginDate,
            loginTime,
            remoteHost
        ] = match;


        // pts/* generally represents remote terminal sessions.
        if (!terminal.startsWith("pts/")) {
            continue;
        }


        sessions.push({
            username,
            terminal,

            loginAt:
                `${loginDate} ${loginTime}`,

            remoteHost:
                remoteHost || null
        });
    }


    return sessions;
}

// ########################################################
// Backup SSH Configuration
// ########################################################

async function backupSshConfiguration() {

    if (!fs.existsSync(SSH_BACKUP)) {

        await fs.promises.copyFile(
            SSH_CONFIG,
            SSH_BACKUP
        );

        return {
            created: true,
            path: SSH_BACKUP
        };
    }


    return {
        created: false,
        path: SSH_BACKUP
    };
}


// ########################################################
// Validate SSH Configuration
// ########################################################

async function validateSshConfiguration() {

    try {

        await runCommand(
            "sshd",
            [
                "-t",
                "-f",
                SSH_CONFIG
            ]
        );


        return {
            valid: true
        };


    } catch (error) {

        return {
            valid: false,

            error:
                error.stderr ||
                error.message ||
                "SSH configuration validation failed"
        };
    }
}



// ########################################################
// Update SSH Setting
// ########################################################

async function updateSshSetting(
    directive,
    value
) {

    await backupSshConfiguration();


    const originalContent =
        await fs.promises.readFile(
            SSH_CONFIG,
            "utf8"
        );


    const lines =
        originalContent.split("\n");


    let replaced = false;


    const updatedLines =
        lines.map(line => {

            const trimmed =
                line.trim();


            // Ignore Match blocks for now.
            if (
                /^Match\s+/i.test(trimmed)
            ) {
                return line;
            }


            const regex =
                new RegExp(
                    `^\\s*#?\\s*${directive}\\s+`,
                    "i"
                );


            if (
                !replaced &&
                regex.test(line)
            ) {

                replaced = true;

                return `${directive} ${value}`;
            }


            return line;
        });


    if (!replaced) {

        updatedLines.push(
            `${directive} ${value}`
        );
    }


    await fs.promises.writeFile(
        SSH_CONFIG,
        updatedLines.join("\n"),
        "utf8"
    );


    // Validate before applying
    const validation =
        await validateSshConfiguration();


    if (!validation.valid) {

        // Restore exact configuration
        // that existed before this request.
        await fs.promises.writeFile(
            SSH_CONFIG,
            originalContent,
            "utf8"
        );


        return {
            success: false,
            type: "validation-failed",
            message:
                "SSH configuration validation failed. Changes were rolled back.",
            error:
                validation.error
        };
    }


    // Reload instead of hard restart
    try {

        await runCommand(
            "systemctl",
            [
                "reload",
                "sshd"
            ]
        );


    } catch (error) {

        // Reload failed → rollback file.
        await fs.promises.writeFile(
            SSH_CONFIG,
            originalContent,
            "utf8"
        );


        // Restore running configuration
        // from rolled-back file.
        try {

            await runCommand(
                "systemctl",
                [
                    "reload",
                    "sshd"
                ]
            );

        } catch (_) {}


        throw error;
    }


    return {
        success: true,

        data: {
            directive,
            value,
            validated: true,
            reloaded: true
        }
    };
}



const ALLOWED_SETTINGS = {

    PasswordAuthentication: [
        "yes",
        "no"
    ],

    PubkeyAuthentication: [
        "yes",
        "no"
    ],

    PermitRootLogin: [
        "yes",
        "no",
        "prohibit-password"
    ]
};


async function changeSshSetting(
    directive,
    value
) {

    if (
        !Object.prototype
            .hasOwnProperty.call(
                ALLOWED_SETTINGS,
                directive
            )
    ) {

        return {
            success: false,
            type: "unsupported",
            message:
                `SSH directive '${directive}' is not managed by LinuxFlow`
        };
    }


    if (
        !ALLOWED_SETTINGS[
            directive
        ].includes(value)
    ) {

        return {
            success: false,
            type: "invalid-value",
            message:
                `Invalid value '${value}' for '${directive}'`
        };
    }


    return await updateSshSetting(
        directive,
        value
    );
}



module.exports = {
    getSshStatus,
    getSshConfiguration,
    getSshOverview,
     getActiveSshSessions,
       backupSshConfiguration,
    validateSshConfiguration,
    changeSshSetting
};