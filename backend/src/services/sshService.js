const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const SSH_CONFIG =
    "/etc/ssh/sshd_config";

const SSH_BACKUP =
    "/etc/ssh/sshd_config.linuxflow.bak";

const DEFAULT_SSH_PORT = 22;

const MIN_PORT = 1;
const MAX_PORT = 65535;

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



// ########################################################
// SSH Port Helpers
// ########################################################

function validatePort(port) {

    const parsedPort = Number(port);

    if (
        !Number.isInteger(parsedPort) ||
        parsedPort < MIN_PORT ||
        parsedPort > MAX_PORT
    ) {
        return {
            valid: false,
            message:
                "SSH port must be an integer between 1 and 65535"
        };
    }

    return {
        valid: true,
        port: parsedPort
    };
}


async function isPortListening(port) {

    try {

        const stdout =
            await runCommand(
                "ss",
                ["-lntH"]
            );

        const regex =
            new RegExp(
                `:${port}\\s`
            );

        return stdout
            .split("\n")
            .some(line =>
                regex.test(line)
            );

    } catch (_) {

        return false;
    }
}


// ########################################################
// SELinux SSH Port
// ########################################################

async function ensureSelinuxSshPort(port) {

    let enforcing = false;

    try {

        const mode =
            await runCommand(
                "getenforce"
            );

        enforcing =
            mode === "Enforcing";

    } catch (_) {}


    if (!enforcing) {

        return {
            required: false,
            changed: false
        };
    }


    const ports =
        await runCommand(
            "semanage",
            [
                "port",
                "-l"
            ]
        );


    const sshLine =
        ports
            .split("\n")
            .find(line =>
                line.trim()
                    .startsWith(
                        "ssh_port_t"
                    )
            );


    if (
        sshLine &&
        new RegExp(
            `\\b${port}\\b`
        ).test(sshLine)
    ) {

        return {
            required: true,
            changed: false
        };
    }


    await runCommand(
        "semanage",
        [
            "port",
            "-a",
            "-t",
            "ssh_port_t",
            "-p",
            "tcp",
            String(port)
        ]
    );


    return {
        required: true,
        changed: true
    };
}


// ########################################################
// Firewalld SSH Port
// ########################################################

async function ensureFirewallSshPort(port) {

    let running = false;

    try {

        const state =
            await runCommand(
                "firewall-cmd",
                ["--state"]
            );

        running =
            state === "running";

    } catch (_) {}


    if (!running) {

        return {
            required: false,
            changed: false
        };
    }


    try {

        await runCommand(
            "firewall-cmd",
            [
                "--quiet",
                "--query-port",
                `${port}/tcp`
            ]
        );


        return {
            required: true,
            changed: false
        };


    } catch (_) {

        await runCommand(
            "firewall-cmd",
            [
                "--permanent",
                "--add-port",
                `${port}/tcp`
            ]
        );


        await runCommand(
            "firewall-cmd",
            [
                "--add-port",
                `${port}/tcp`
            ]
        );


        return {
            required: true,
            changed: true
        };
    }
}



// ########################################################
// Add SSH Port
// ########################################################

async function addSshPort(port) {

    const validation =
        validatePort(port);


    if (!validation.valid) {

        return {
            success: false,
            type: "invalid-port",
            message:
                validation.message
        };
    }


    const newPort =
        validation.port;


    // ----------------------------------------------------
    // Read current effective SSH ports
    // ----------------------------------------------------

    const effectiveConfig =
        await runCommand(
            "sshd",
            ["-T"]
        );


    const existingPorts =
        effectiveConfig
            .split("\n")
            .filter(line =>
                line.startsWith("port ")
            )
            .map(line =>
                Number(
                    line.split(/\s+/)[1]
                )
            );


    if (
        existingPorts.includes(
            newPort
        )
    ) {

        return {
            success: false,
            type: "already-configured",
            message:
                `SSH port ${newPort} is already configured`
        };
    }


    // ----------------------------------------------------
    // Port must not already belong to another service
    // ----------------------------------------------------

    if (
        await isPortListening(
            newPort
        )
    ) {

        return {
            success: false,
            type: "port-in-use",
            message:
                `Port ${newPort} is already in use`
        };
    }


    await backupSshConfiguration();


    const originalContent =
        await fs.promises.readFile(
            SSH_CONFIG,
            "utf8"
        );


    let selinuxResult = null;
    let firewallResult = null;


    try {

        // ------------------------------------------------
        // Prepare SELinux
        // ------------------------------------------------

        selinuxResult =
            await ensureSelinuxSshPort(
                newPort
            );


        // ------------------------------------------------
        // Prepare firewall
        // ------------------------------------------------

        firewallResult =
            await ensureFirewallSshPort(
                newPort
            );


        // ------------------------------------------------
        // IMPORTANT:
        // Keep existing SSH port and ADD the new one.
        // ------------------------------------------------

        let updatedContent =
            originalContent;


        // If no explicit Port directive exists,
        // make default port 22 explicit first.

        const explicitPortRegex =
            /^\s*Port\s+\d+\s*$/im;


        if (
            !explicitPortRegex.test(
                updatedContent
            )
        ) {

            updatedContent +=
                `\nPort ${DEFAULT_SSH_PORT}\n`;
        }


        updatedContent +=
            `Port ${newPort}\n`;


        await fs.promises.writeFile(
            SSH_CONFIG,
            updatedContent,
            "utf8"
        );


        // ------------------------------------------------
        // Validate configuration BEFORE reload
        // ------------------------------------------------

        const configValidation =
            await validateSshConfiguration();


        if (!configValidation.valid) {

            await fs.promises.writeFile(
                SSH_CONFIG,
                originalContent,
                "utf8"
            );


            return {
                success: false,
                type: "validation-failed",
                message:
                    "SSH configuration validation failed and was rolled back",
                error:
                    configValidation.error
            };
        }


        // ------------------------------------------------
        // Reload sshd
        // ------------------------------------------------

        await runCommand(
            "systemctl",
            [
                "reload",
                "sshd"
            ]
        );


        // Give sshd a moment to update listeners.
        await new Promise(resolve =>
            setTimeout(resolve, 500)
        );


        // ------------------------------------------------
        // Verify new listener
        // ------------------------------------------------

        const listening =
            await isPortListening(
                newPort
            );


        if (!listening) {

            await fs.promises.writeFile(
                SSH_CONFIG,
                originalContent,
                "utf8"
            );


            try {

                await runCommand(
                    "systemctl",
                    [
                        "reload",
                        "sshd"
                    ]
                );

            } catch (_) {}


            return {
                success: false,
                type: "listener-failed",
                message:
                    `sshd did not start listening on port ${newPort}. Configuration was rolled back.`
            };
        }


        return {
            success: true,

            data: {
                newPort,

                oldPortPreserved: true,

                selinux:
                    selinuxResult,

                firewall:
                    firewallResult,

                validated: true,
                reloaded: true,
                listening: true
            }
        };


    } catch (error) {

        // Restore sshd_config
        await fs.promises.writeFile(
            SSH_CONFIG,
            originalContent,
            "utf8"
        );


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
}


// ########################################################
// Remove SSH Port
// ########################################################

async function removeSshPort(port) {

    const validation = validatePort(port);

    if (!validation.valid) {
        return {
            success: false,
            type: "invalid-port",
            message: validation.message
        };
    }

    const removePort = validation.port;


    // Never allow LinuxFlow to remove the fallback port.
    if (removePort === DEFAULT_SSH_PORT) {
        return {
            success: false,
            type: "protected-port",
            message:
                `SSH port ${DEFAULT_SSH_PORT} is protected and cannot be removed`
        };
    }


    const originalContent =
        await fs.promises.readFile(
            SSH_CONFIG,
            "utf8"
        );


    const portRegex =
        new RegExp(
            `^\\s*Port\\s+${removePort}\\s*$`,
            "im"
        );


    if (!portRegex.test(originalContent)) {
        return {
            success: false,
            type: "not-configured",
            message:
                `SSH port ${removePort} is not explicitly configured`
        };
    }


    // Remove only this exact Port directive.
    const updatedContent =
        originalContent
            .split("\n")
            .filter(line => {

                const regex =
                    new RegExp(
                        `^\\s*Port\\s+${removePort}\\s*$`,
                        "i"
                    );

                return !regex.test(line);
            })
            .join("\n");


    try {

        await fs.promises.writeFile(
            SSH_CONFIG,
            updatedContent,
            "utf8"
        );


        // Validate BEFORE reload.
        const configValidation =
            await validateSshConfiguration();


        if (!configValidation.valid) {

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
                    configValidation.error
            };
        }


        await runCommand(
            "systemctl",
            [
                "reload",
                "sshd"
            ]
        );


        await new Promise(resolve =>
            setTimeout(resolve, 500)
        );


        // Port should no longer be listening.
        const stillListening =
            await isPortListening(
                removePort
            );


        if (stillListening) {

            await fs.promises.writeFile(
                SSH_CONFIG,
                originalContent,
                "utf8"
            );

            try {
                await runCommand(
                    "systemctl",
                    ["reload", "sshd"]
                );
            } catch (_) {}

            return {
                success: false,
                type: "listener-still-active",
                message:
                    `SSH port ${removePort} remained active. Configuration was rolled back.`
            };
        }


        // Remove firewalld rule.
        try {

            await runCommand(
                "firewall-cmd",
                [
                    "--remove-port",
                    `${removePort}/tcp`
                ]
            );

            await runCommand(
                "firewall-cmd",
                [
                    "--permanent",
                    "--remove-port",
                    `${removePort}/tcp`
                ]
            );

        } catch (_) {
            // SSH configuration itself is already safely updated.
        }


        // Remove SELinux mapping created for alternate SSH port.
        try {

            await runCommand(
                "semanage",
                [
                    "port",
                    "-d",
                    "-t",
                    "ssh_port_t",
                    "-p",
                    "tcp",
                    String(removePort)
                ]
            );

        } catch (_) {
            // Don't fail the entire operation only because cleanup
            // could not remove an SELinux mapping.
        }


        return {
            success: true,

            data: {
                removedPort: removePort,
                defaultPortPreserved:
                    DEFAULT_SSH_PORT,
                validated: true,
                reloaded: true,
                listenerRemoved: true
            }
        };


    } catch (error) {

        await fs.promises.writeFile(
            SSH_CONFIG,
            originalContent,
            "utf8"
        );

        try {
            await runCommand(
                "systemctl",
                ["reload", "sshd"]
            );
        } catch (_) {}

        throw error;
    }
}




module.exports = {
    getSshStatus,
    getSshConfiguration,
    getSshOverview,
     getActiveSshSessions,
       backupSshConfiguration,
    validateSshConfiguration,
    changeSshSetting,
    addSshPort,
    removeSshPort
};