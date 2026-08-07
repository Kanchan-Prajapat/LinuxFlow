const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);


async function runFirewallCommand(args) {

    try {

        const { stdout } =
            await execFileAsync(
                "firewall-cmd",
                args,
                {
                    timeout: 10000,
                    maxBuffer: 1024 * 1024
                }
            );

        return stdout.trim();

    } catch (error) {

        if (error.code === "ENOENT") {
            throw new Error(
                "FIREWALL_COMMAND_MISSING"
            );
        }

        throw error;
    }
}


async function getFirewallStatus() {

    let running = false;

    try {

        const state =
            await runFirewallCommand([
                "--state"
            ]);

        running = state === "running";

    } catch (error) {

        if (
            error.message ===
            "FIREWALL_COMMAND_MISSING"
        ) {
            throw error;
        }

        running = false;
    }


    let defaultZone = null;
    let activeZones = [];


    if (running) {

        defaultZone =
            await runFirewallCommand([
                "--get-default-zone"
            ]);


        const output =
            await runFirewallCommand([
                "--get-active-zones"
            ]);


        const lines =
            output.split("\n");


        let currentZone = null;


        for (const line of lines) {

            if (!line.startsWith(" ")) {

                currentZone =
                    line.trim();

                if (currentZone) {

                    activeZones.push({
                        name: currentZone,
                        interfaces: []
                    });
                }

                continue;
            }


            const trimmed =
                line.trim();


            if (
                currentZone &&
                trimmed.startsWith(
                    "interfaces:"
                )
            ) {

                const interfaces =
                    trimmed
                        .replace(
                            "interfaces:",
                            ""
                        )
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean);


                const zone =
                    activeZones.find(
                        item =>
                            item.name ===
                            currentZone
                    );


                if (zone) {
                    zone.interfaces =
                        interfaces;
                }
            }
        }
    }


    return {
        running,
        defaultZone,
        activeZones
    };
}


async function getZones() {

    const output =
        await runFirewallCommand([
            "--get-zones"
        ]);


    return output
        .split(/\s+/)
        .filter(Boolean);
}


async function getZoneDetails(zone) {

    const output =
        await runFirewallCommand([
            "--zone",
            zone,
            "--list-all"
        ]);


    const lines =
        output.split("\n");


    const data = {
        name: zone,
        active: false,
        target: null,
        interfaces: [],
        sources: [],
        services: [],
        ports: [],
        protocols: [],
        forward: false,
        masquerade: false,
        forwardPorts: [],
        sourcePorts: [],
        icmpBlocks: [],
        richRules: []
    };


    for (const rawLine of lines) {

        const line =
            rawLine.trim();


        if (!line) {
            continue;
        }


        // First line:
        // public (active)

        if (
            line.startsWith(
                `${zone} `
            ) ||
            line === zone
        ) {

            data.active =
                line.includes("(active)");

            continue;
        }


        const separator =
            line.indexOf(":");


        if (separator === -1) {
            continue;
        }


        const key =
            line
                .slice(0, separator)
                .trim();


        const value =
            line
                .slice(separator + 1)
                .trim();


        const list =
            value
                ? value.split(/\s+/)
                : [];


        switch (key) {

            case "target":
                data.target = value;
                break;

            case "interfaces":
                data.interfaces = list;
                break;

            case "sources":
                data.sources = list;
                break;

            case "services":
                data.services = list;
                break;

            case "ports":
                data.ports = list;
                break;

            case "protocols":
                data.protocols = list;
                break;

            case "forward":
                data.forward =
                    value === "yes";
                break;

            case "masquerade":
                data.masquerade =
                    value === "yes";
                break;

            case "forward-ports":
                data.forwardPorts = list;
                break;

            case "source-ports":
                data.sourcePorts = list;
                break;

            case "icmp-blocks":
                data.icmpBlocks = list;
                break;

            case "rich rules":
                data.richRules =
                    value ? [value] : [];
                break;
        }
    }


    return data;
}


async function getServices() {

    const output =
        await runFirewallCommand([
            "--get-services"
        ]);


    return output
        .split(/\s+/)
        .filter(Boolean);
}

function isValidPort(port) {

    const number = Number(port);

    return (
        Number.isInteger(number) &&
        number >= 1 &&
        number <= 65535
    );
}


function isValidProtocol(protocol) {

    return (
        protocol === "tcp" ||
        protocol === "udp"
    );
}


async function isPortEnabled(
    zone,
    port,
    protocol,
    permanent = false
) {

    const args = [];

    if (permanent) {
        args.push("--permanent");
    }

    args.push(
        "--zone",
        zone,
        "--query-port",
        `${port}/${protocol}`
    );


    try {

        const output =
            await runFirewallCommand(args);

        return output === "yes";

    } catch (error) {

        /*
         * firewall-cmd --query-port returns
         * non-zero when the answer is "no".
         */

        if (
            String(error.stdout || "")
                .trim() === "no"
        ) {
            return false;
        }

        throw error;
    }
}


async function addPort(
    zone,
    port,
    protocol
) {

    if (
        !isValidPort(port) ||
        !isValidProtocol(protocol)
    ) {

        return {
            success: false,
            type: "invalid",
            message:
                "Invalid firewall port or protocol"
        };
    }


    const portRule =
        `${port}/${protocol}`;


    const alreadyPermanent =
        await isPortEnabled(
            zone,
            port,
            protocol,
            true
        );


    if (alreadyPermanent) {

        return {
            success: false,
            type: "exists",
            message:
                `Port '${portRule}' is already enabled in zone '${zone}'`
        };
    }


    try {

        // Permanent configuration
        await runFirewallCommand([
            "--permanent",
            "--zone",
            zone,
            "--add-port",
            portRule
        ]);


        // Runtime configuration
        await runFirewallCommand([
            "--zone",
            zone,
            "--add-port",
            portRule
        ]);


        return {
            success: true,
            data: {
                zone,
                port: Number(port),
                protocol,
                rule: portRule
            }
        };


    } catch (error) {

        /*
         * Roll back permanent config if
         * runtime update failed.
         */

        try {

            await runFirewallCommand([
                "--permanent",
                "--zone",
                zone,
                "--remove-port",
                portRule
            ]);

        } catch (_) {}


        throw error;
    }
}


async function removePort(
    zone,
    port,
    protocol
) {

    if (
        !isValidPort(port) ||
        !isValidProtocol(protocol)
    ) {

        return {
            success: false,
            type: "invalid",
            message:
                "Invalid firewall port or protocol"
        };
    }


    const portRule =
        `${port}/${protocol}`;


    const permanentEnabled =
        await isPortEnabled(
            zone,
            port,
            protocol,
            true
        );


    const runtimeEnabled =
        await isPortEnabled(
            zone,
            port,
            protocol,
            false
        );


    if (
        !permanentEnabled &&
        !runtimeEnabled
    ) {

        return {
            success: false,
            type: "not-found",
            message:
                `Port '${portRule}' is not enabled in zone '${zone}'`
        };
    }


    if (permanentEnabled) {

        await runFirewallCommand([
            "--permanent",
            "--zone",
            zone,
            "--remove-port",
            portRule
        ]);
    }


    if (runtimeEnabled) {

        await runFirewallCommand([
            "--zone",
            zone,
            "--remove-port",
            portRule
        ]);
    }


    return {
        success: true,

        data: {
            zone,
            port: Number(port),
            protocol,
            rule: portRule
        }
    };
}

async function serviceExists(service) {

    const services =
        await getServices();

    return services.includes(service);
}


async function isServiceEnabled(
    zone,
    service,
    permanent = false
) {

    const args = [];

    if (permanent) {
        args.push("--permanent");
    }

    args.push(
        "--zone",
        zone,
        "--query-service",
        service
    );


    try {

        const output =
            await runFirewallCommand(args);

        return output === "yes";

    } catch (error) {

        if (
            String(error.stdout || "")
                .trim() === "no"
        ) {
            return false;
        }

        throw error;
    }
}


async function addService(
    zone,
    service
) {

    const exists =
        await serviceExists(service);


    if (!exists) {

        return {
            success: false,
            type: "invalid-service",
            message:
                `Firewall service '${service}' does not exist`
        };
    }


    const permanentEnabled =
        await isServiceEnabled(
            zone,
            service,
            true
        );


    if (permanentEnabled) {

        return {
            success: false,
            type: "exists",
            message:
                `Service '${service}' is already enabled in zone '${zone}'`
        };
    }


    try {

        await runFirewallCommand([
            "--permanent",
            "--zone",
            zone,
            "--add-service",
            service
        ]);


        await runFirewallCommand([
            "--zone",
            zone,
            "--add-service",
            service
        ]);


        return {
            success: true,

            data: {
                zone,
                service
            }
        };


    } catch (error) {

        // Rollback permanent change
        try {

            await runFirewallCommand([
                "--permanent",
                "--zone",
                zone,
                "--remove-service",
                service
            ]);

        } catch (_) {}


        throw error;
    }
}


async function removeService(
    zone,
    service
) {

    const exists =
        await serviceExists(service);


    if (!exists) {

        return {
            success: false,
            type: "invalid-service",
            message:
                `Firewall service '${service}' does not exist`
        };
    }

    if (service === "ssh") {

    return {
        success: false,
        type: "protected-service",
        message:
            "SSH firewall service is protected and cannot be removed through LinuxFlow"
    };
}


    const permanentEnabled =
        await isServiceEnabled(
            zone,
            service,
            true
        );


    const runtimeEnabled =
        await isServiceEnabled(
            zone,
            service,
            false
        );


    if (
        !permanentEnabled &&
        !runtimeEnabled
    ) {

        return {
            success: false,
            type: "not-found",
            message:
                `Service '${service}' is not enabled in zone '${zone}'`
        };
    }


    if (permanentEnabled) {

        await runFirewallCommand([
            "--permanent",
            "--zone",
            zone,
            "--remove-service",
            service
        ]);
    }


    if (runtimeEnabled) {

        await runFirewallCommand([
            "--zone",
            zone,
            "--remove-service",
            service
        ]);
    }


    return {
        success: true,

        data: {
            zone,
            service
        }
    };
}


async function reloadFirewall() {

    await runFirewallCommand([
        "--reload"
    ]);

    const status =
        await getFirewallStatus();

    return {
        reloaded: true,
        ...status
    };
}

async function getZoneConfig(
    zone,
    permanent = false
) {

    const args = [];

    if (permanent) {
        args.push("--permanent");
    }

    args.push(
        "--zone",
        zone,
        "--list-all"
    );

    return runFirewallCommand(args);
}


function extractConfigValue(
    output,
    key
) {

    const line =
        output
            .split("\n")
            .map(item => item.trim())
            .find(item =>
                item.startsWith(`${key}:`)
            );


    if (!line) {
        return [];
    }


    const value =
        line
            .slice(key.length + 1)
            .trim();


    return value
        ? value.split(/\s+/)
        : [];
}


async function getSyncStatus(zone) {

    const runtime =
        await getZoneConfig(
            zone,
            false
        );


    const permanent =
        await getZoneConfig(
            zone,
            true
        );


    const runtimePorts =
        extractConfigValue(
            runtime,
            "ports"
        );


    const permanentPorts =
        extractConfigValue(
            permanent,
            "ports"
        );


    const runtimeServices =
        extractConfigValue(
            runtime,
            "services"
        );


    const permanentServices =
        extractConfigValue(
            permanent,
            "services"
        );


    const normalize =
        values =>
            [...values].sort();


    const portsInSync =
        JSON.stringify(
            normalize(runtimePorts)
        ) ===
        JSON.stringify(
            normalize(permanentPorts)
        );


    const servicesInSync =
        JSON.stringify(
            normalize(runtimeServices)
        ) ===
        JSON.stringify(
            normalize(permanentServices)
        );


    return {

        zone,

        inSync:
            portsInSync &&
            servicesInSync,

        ports: {
            inSync: portsInSync,
            runtime: runtimePorts,
            permanent: permanentPorts
        },

        services: {
            inSync: servicesInSync,
            runtime: runtimeServices,
            permanent: permanentServices
        }
    };
}




module.exports = {
    getFirewallStatus,
    getZones,
    getZoneDetails,
    getServices,
    addPort,
    removePort,
       addService,
    removeService,
        reloadFirewall,
    getSyncStatus
};