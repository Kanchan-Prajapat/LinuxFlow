const os = require("os");

function getSystemInfo() {
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        architecture: os.arch(),
        kernel: os.release(),
        uptimeSeconds: os.uptime(),
        cpuCores: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
    };
}

module.exports = {
    getSystemInfo
};