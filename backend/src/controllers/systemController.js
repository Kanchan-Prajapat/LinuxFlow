const systemService = require("../services/systemService");

function getSystemInfo(req, res) {
    try {
        const systemInfo = systemService.getSystemInfo();

        return res.status(200).json({
            success: true,
            data: systemInfo
        });

    } catch (error) {
        console.error("System info error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve system information"
        });
    }
}


async function getDashboardOverview(req, res) {

    try {

      const overview =
    await systemService.getDashboardOverview();

        return res.status(200).json({
            success: true,
            data: overview
        });

    } catch (error) {

        console.error("Dashboard overview error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve dashboard overview"
        });
    }
}


async function getDiskUsage(req, res) {

    try {

        const disks =
            await systemService.getDiskUsage();

        return res.status(200).json({
            success: true,
            count: disks.length,
            data: disks
        });

    } catch (error) {

        console.error("Disk usage error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve disk usage"
        });
    }
}



module.exports = {
    getSystemInfo,
    getDashboardOverview,
    getDiskUsage
};