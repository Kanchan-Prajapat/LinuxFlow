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




module.exports = {
    getFirewallStatus,
    getZones,
    getZoneDetails,
    getServices,
    addPort,
    removePort
};