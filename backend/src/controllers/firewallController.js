const firewallService =
    require("../services/firewallService");


function validateZone(zone) {

    return (
        typeof zone === "string" &&
        /^[a-zA-Z0-9_-]+$/.test(zone)
    );
}


async function getStatus(req, res) {

    try {

        const data =
            await firewallService
                .getFirewallStatus();


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        console.error(
            "Firewall status error:",
            error
        );


        if (
            error.message ===
            "FIREWALL_COMMAND_MISSING"
        ) {

            return res.status(503).json({
                success: false,
                message:
                    "firewall-cmd is not installed"
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve firewall status"
        });
    }
}


async function getZones(req, res) {

    try {

        const zones =
            await firewallService
                .getZones();


        return res.status(200).json({
            success: true,
            count: zones.length,
            data: zones
        });


    } catch (error) {

        console.error(
            "Firewall zones error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve firewall zones"
        });
    }
}


async function getZoneDetails(req, res) {

    try {

        const { zone } =
            req.params;


        if (!validateZone(zone)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid firewall zone"
            });
        }


        const data =
            await firewallService
                .getZoneDetails(zone);


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        console.error(
            "Firewall zone details error:",
            error
        );


        const stderr =
            String(error.stderr || "");


        if (
            stderr.includes(
                "INVALID_ZONE"
            )
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Firewall zone not found"
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve firewall zone"
        });
    }
}


async function getServices(req, res) {

    try {

        const services =
            await firewallService
                .getServices();


        return res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });


    } catch (error) {

        console.error(
            "Firewall services error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve firewall services"
        });
    }
}


function validatePort(port) {

    const number = Number(port);

    return (
        Number.isInteger(number) &&
        number >= 1 &&
        number <= 65535
    );
}


function validateProtocol(protocol) {

    return (
        protocol === "tcp" ||
        protocol === "udp"
    );
}


async function addPort(req, res) {

    try {

        const {
            zone,
            port,
            protocol
        } = req.body;


        if (
            !validateZone(zone) ||
            !validatePort(port) ||
            !validateProtocol(protocol)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid zone, port (1-65535) and protocol (tcp/udp) are required"
            });
        }


        const result =
            await firewallService.addPort(
                zone,
                port,
                protocol
            );


        if (!result.success) {

            if (
                result.type === "invalid" ||
                result.type === "exists"
            ) {

                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }
        }


        return res.status(201).json({
            success: true,
            message:
                `Firewall port '${port}/${protocol}' enabled successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Add firewall port error:",
            error
        );


        const stderr =
            String(error.stderr || "");


        if (stderr.includes("INVALID_ZONE")) {

            return res.status(404).json({
                success: false,
                message:
                    "Firewall zone not found"
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Unable to enable firewall port"
        });
    }
}


async function removePort(req, res) {

    try {

        const {
            zone,
            port,
            protocol
        } = req.body;


        if (
            !validateZone(zone) ||
            !validatePort(port) ||
            !validateProtocol(protocol)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid zone, port and protocol are required"
            });
        }


        const result =
            await firewallService.removePort(
                zone,
                port,
                protocol
            );


        if (!result.success) {

            if (result.type === "not-found") {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            return res.status(400).json({
                success: false,
                message: result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `Firewall port '${port}/${protocol}' removed successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Remove firewall port error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to remove firewall port"
        });
    }
}

function validateServiceName(service) {

    return (
        typeof service === "string" &&
        /^[a-zA-Z0-9_-]+$/.test(service)
    );
}

async function addService(req, res) {

    try {

        const {
            zone,
            service
        } = req.body;


        if (
            !validateZone(zone) ||
            !validateServiceName(service)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid firewall zone and service are required"
            });
        }


        const result =
            await firewallService
                .addService(
                    zone,
                    service
                );


        if (!result.success) {

            if (
                result.type ===
                "invalid-service"
            ) {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (result.type === "exists") {

                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }
        }


        return res.status(201).json({
            success: true,
            message:
                `Firewall service '${service}' enabled successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Add firewall service error:",
            error
        );


        const stderr =
            String(error.stderr || "");


        if (stderr.includes("INVALID_ZONE")) {

            return res.status(404).json({
                success: false,
                message:
                    "Firewall zone not found"
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Unable to enable firewall service"
        });
    }
}


async function removeService(req, res) {

    try {

        const {
            zone,
            service
        } = req.body;


        if (
            !validateZone(zone) ||
            !validateServiceName(service)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Valid firewall zone and service are required"
            });
        }


        const result =
            await firewallService
                .removeService(
                    zone,
                    service
                );


                if (
    result.type ===
    "protected-service"
) {

    return res.status(403).json({
        success: false,
        message: result.message
    });
}


        if (!result.success) {

            if (
                result.type ===
                "invalid-service"
            ) {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (
                result.type ===
                "not-found"
            ) {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }
        }


        return res.status(200).json({
            success: true,
            message:
                `Firewall service '${service}' removed successfully`,
            data: result.data
        });


    } catch (error) {

        console.error(
            "Remove firewall service error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to remove firewall service"
        });
    }
}



async function getSyncStatus(req, res) {

    try {

        const {
            zone
        } = req.params;


        if (!validateZone(zone)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid firewall zone"
            });
        }


        const data =
            await firewallService
                .getSyncStatus(zone);


        return res.status(200).json({
            success: true,
            data
        });


    } catch (error) {

        console.error(
            "Firewall sync status error:",
            error
        );


        const stderr =
            String(error.stderr || "");


        if (
            stderr.includes(
                "INVALID_ZONE"
            )
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Firewall zone not found"
            });
        }


        return res.status(500).json({
            success: false,
            message:
                "Unable to determine firewall sync status"
        });
    }
}



async function reloadFirewall(req, res) {

    try {

        const {
            confirmation
        } = req.body || {};


        if (
            confirmation !==
            "RELOAD FIREWALL"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid firewall reload confirmation",
                requiredConfirmation:
                    "RELOAD FIREWALL"
            });
        }


        const data =
            await firewallService
                .reloadFirewall();


        return res.status(200).json({
            success: true,
            message:
                "Firewall reloaded successfully",
            data
        });


    } catch (error) {

        console.error(
            "Firewall reload error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to reload firewall"
        });
    }
}



module.exports = {
    getStatus,
    getZones,
    getZoneDetails,
    getServices,
      addPort,
    removePort,
    addService,
    removeService,
      getSyncStatus,
    reloadFirewall
};