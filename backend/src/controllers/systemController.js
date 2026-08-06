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

module.exports = {
    getSystemInfo,
    getDashboardOverview
};