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

module.exports = {
    getSystemInfo
};