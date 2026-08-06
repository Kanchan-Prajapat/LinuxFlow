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

        const summary = {
            normal: 0,
            warning: 0,
            critical: 0
        };

        disks.forEach(disk => {

            if (disk.status === "critical") {
                summary.critical++;
            } else if (disk.status === "warning") {
                summary.warning++;
            } else {
                summary.normal++;
            }

        });

        return res.status(200).json({
            success: true,
            count: disks.length,
            summary,
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


async function getSystemHealth(req, res) {

    try {

        const health =
            await systemService.getSystemHealth();

        return res.status(200).json({
            success: true,
            data: health
        });

    } catch (error) {

        console.error("System health error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to determine system health"
        });
    }
}


module.exports = {
    getSystemInfo,
    getDashboardOverview,
    getDiskUsage,
    getSystemHealth
};