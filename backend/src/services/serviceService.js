const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);


async function getServices() {

    const { stdout } = await execFileAsync(
        "systemctl",
        [
            "list-units",
            "--type=service",
            "--all",
            "--no-legend",
            "--no-pager",
            "--plain"
        ],
        {
            maxBuffer: 1024 * 1024
        }
    );

    const lines = stdout
        .trim()
        .split("\n")
        .filter(Boolean);

    const services = [];

    for (const line of lines) {

        const parts = line
            .trim()
            .split(/\s+/);

        if (parts.length < 4) {
            continue;
        }

        const [
            unit,
            load,
            active,
            sub,
            ...descriptionParts
        ] = parts;

        services.push({
            name: unit,
            load,
            active,
            sub,
            description:
                descriptionParts.join(" ")
        });
    }

    return services;
}


async function getServiceByName(name) {

    const serviceName =
        name.endsWith(".service")
            ? name
            : `${name}.service`;

    try {

        const { stdout } = await execFileAsync(
            "systemctl",
            [
                "show",
                serviceName,
                "--no-pager",
                "--property=Id,Description,LoadState,ActiveState,SubState,UnitFileState,MainPID"
            ]
        );

        const properties = {};

        stdout
            .trim()
            .split("\n")
            .forEach(line => {

                const separator =
                    line.indexOf("=");

                if (separator === -1) {
                    return;
                }

                const key =
                    line.slice(0, separator);

                const value =
                    line.slice(separator + 1);

                properties[key] = value;
            });


        // systemctl show can return properties even
        // when the requested unit does not exist.
        if (
            !properties.Id ||
            properties.LoadState === "not-found"
        ) {
            return null;
        }


        return {
            name: properties.Id,
            description:
                properties.Description || "",
            loadState:
                properties.LoadState || "unknown",
            activeState:
                properties.ActiveState || "unknown",
            subState:
                properties.SubState || "unknown",
            unitFileState:
                properties.UnitFileState || "unknown",
            mainPid:
                Number(properties.MainPID || 0)
        };

    } catch (error) {

        throw error;
    }
}

function normalizeServiceName(name) {

    return name.endsWith(".service")
        ? name
        : `${name}.service`;
}


const protectedStopServices = new Set([
    "systemd.service",
    "dbus.service",
    "NetworkManager.service",
    "sshd.service",
    "systemd-logind.service",
    "systemd-journald.service"
]);


function isProtectedFromStop(serviceName) {

    return protectedStopServices.has(
        serviceName
    );
}

async function manageService(name, action) {

    const validActions = [
        "start",
        "stop",
        "restart"
    ];

    if (!validActions.includes(action)) {

        return {
            success: false,
            type: "invalid-action",
            message: "Invalid service action"
        };
    }


    const serviceName =
        normalizeServiceName(name);


    const service =
        await getServiceByName(serviceName);


    if (!service) {

        return {
            success: false,
            type: "not-found",
            message:
                `Service '${serviceName}' not found`
        };
    }


    // Stop/restart can interrupt critical connectivity
    if (
        (action === "stop" ||
         action === "restart") &&
        isProtectedFromStop(serviceName)
    ) {

        return {
            success: false,
            type: "protected",
            message:
                `Service '${serviceName}' is protected from ${action}`
        };
    }


    try {

        await execFileAsync(
            "systemctl",
            [
                action,
                serviceName
            ],
            {
                timeout: 15000
            }
        );


        const updatedService =
            await getServiceByName(
                serviceName
            );


        return {
            success: true,
            action,
            service: updatedService
        };


    } catch (error) {

        return {
            success: false,
            type: "systemctl-error",
            message:
                `Unable to ${action} service '${serviceName}'`
        };
    }
}




module.exports = {
    getServices,
    getServiceByName,
    manageService
};