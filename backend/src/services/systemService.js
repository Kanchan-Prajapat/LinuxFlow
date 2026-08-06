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


function formatBytes(bytes) {
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(" ") : "< 1m";
}


function getCpuTimes() {

    const cpus = os.cpus();

    let idle = 0;
    let total = 0;

    cpus.forEach(cpu => {

        idle += cpu.times.idle;

        total +=
            cpu.times.user +
            cpu.times.nice +
            cpu.times.sys +
            cpu.times.idle +
            cpu.times.irq;
    });

    return {
        idle,
        total
    };
}


function getCpuUsage() {

    return new Promise(resolve => {

        const start = getCpuTimes();

        setTimeout(() => {

            const end = getCpuTimes();

            const idleDifference =
                end.idle - start.idle;

            const totalDifference =
                end.total - start.total;

            if (totalDifference <= 0) {
                resolve(0);
                return;
            }

            const usage =
                100 -
                ((idleDifference / totalDifference) * 100);

            resolve(
                Number(usage.toFixed(2))
            );

        }, 500);

    });
}

async function getDashboardOverview() {

    const cpuUsage = await getCpuUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const memoryUsage =
        totalMemory > 0
            ? (usedMemory / totalMemory) * 100
            : 0;

    const uptime = os.uptime();

    return {
        system: {
            hostname: os.hostname(),
            platform: os.platform(),
            architecture: os.arch(),
            kernel: os.release()
        },

     cpu: {
    cores: os.cpus().length,
    usagePercent: cpuUsage,

    loadAverage: os.loadavg().map(value =>
        Number(value.toFixed(2))
    )
},

        memory: {
            totalBytes: totalMemory,
            usedBytes: usedMemory,
            freeBytes: freeMemory,

            total: formatBytes(totalMemory),
            used: formatBytes(usedMemory),
            free: formatBytes(freeMemory),

            usagePercent: Number(memoryUsage.toFixed(2))
        },

        uptime: {
            seconds: Math.floor(uptime),
            formatted: formatUptime(uptime)
        }
    };
}


module.exports = {
    getSystemInfo,
    getDashboardOverview
};