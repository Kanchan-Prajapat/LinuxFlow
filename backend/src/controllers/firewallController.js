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


module.exports = {
    getStatus,
    getZones,
    getZoneDetails,
    getServices
};