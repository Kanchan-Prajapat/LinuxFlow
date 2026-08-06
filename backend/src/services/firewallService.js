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


module.exports = {
    getFirewallStatus,
    getZones,
    getZoneDetails,
    getServices
};