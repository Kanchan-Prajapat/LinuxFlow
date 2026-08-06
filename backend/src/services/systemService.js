const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

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


async function getDiskUsage() {

    const { stdout } = await execFileAsync(
        "df",
        [
            "-B1",
            "--output=source,fstype,size,used,avail,pcent,target",
            "-x", "tmpfs",
            "-x", "devtmpfs"
        ]
    );

    const lines = stdout
        .trim()
        .split("\n")
        .slice(1);

    const filesystems = [];

    const ignoredTypes = new Set([
        "iso9660",
        "squashfs",
        "overlay",
        "proc",
        "sysfs",
        "cgroup",
        "cgroup2"
    ]);

    for (const line of lines) {

        const parts = line.trim().split(/\s+/);

        if (parts.length < 7) {
            continue;
        }

        const [
            filesystem,
            filesystemType,
            size,
            used,
            available,
            usage,
            ...mountParts
        ] = parts;

        const mountPoint = mountParts.join(" ");

        // Ignore pseudo/removable filesystems
        if (ignoredTypes.has(filesystemType)) {
            continue;
        }

        const sizeBytes = Number(size);
        const usedBytes = Number(used);
        const availableBytes = Number(available);

        const usagePercent =
            Number(usage.replace("%", ""));

        // Ignore malformed filesystem records
        if (
            !Number.isFinite(sizeBytes) ||
            !Number.isFinite(usedBytes) ||
            !Number.isFinite(availableBytes) ||
            !Number.isFinite(usagePercent)
        ) {
            continue;
        }

        let status = "normal";

        if (usagePercent >= 90) {
            status = "critical";
        } else if (usagePercent >= 70) {
            status = "warning";
        }

        filesystems.push({
            filesystem,
            filesystemType,
            mountPoint,

            sizeBytes,
            usedBytes,
            availableBytes,

            size: formatBytes(sizeBytes),
            used: formatBytes(usedBytes),
            available: formatBytes(availableBytes),

            usagePercent,
            status
        });
    }

    return filesystems;
}



async function getSystemHealth() {

    const overview = await getDashboardOverview();
    const disks = await getDiskUsage();

    const cpuUsage = overview.cpu.usagePercent;
    const memoryUsage = overview.memory.usagePercent;

    const loadAverage = overview.cpu.loadAverage[0];
    const cpuCores = overview.cpu.cores;

    // Normalize 1-minute load against CPU core count
    const loadPercent =
        cpuCores > 0
            ? (loadAverage / cpuCores) * 100
            : 0;


   // ########################################################
    // CPU Health
   // ########################################################

    let cpuStatus = "healthy";

    if (cpuUsage >= 90) {
        cpuStatus = "critical";
    } else if (cpuUsage >= 70) {
        cpuStatus = "warning";
    }


    //########################################################
    // Memory Health
    //########################################################

    let memoryStatus = "healthy";

    if (memoryUsage >= 90) {
        memoryStatus = "critical";
    } else if (memoryUsage >= 75) {
        memoryStatus = "warning";
    }


    //########################################################
    // Load Health
    //########################################################

    let loadStatus = "healthy";

    if (loadPercent >= 100) {
        loadStatus = "critical";
    } else if (loadPercent >= 70) {
        loadStatus = "warning";
    }


    //########################################################
    // Disk Health
    //########################################################

    let diskStatus = "healthy";

    const criticalDisks =
        disks.filter(disk =>
            disk.status === "critical"
        );

    const warningDisks =
        disks.filter(disk =>
            disk.status === "warning"
        );

    if (criticalDisks.length > 0) {
        diskStatus = "critical";
    } else if (warningDisks.length > 0) {
        diskStatus = "warning";
    }


   // ########################################################
    // Overall Health
   // ########################################################

    const statuses = [
        cpuStatus,
        memoryStatus,
        loadStatus,
        diskStatus
    ];

    let overallStatus = "healthy";

    if (statuses.includes("critical")) {
        overallStatus = "critical";
    } else if (statuses.includes("warning")) {
        overallStatus = "warning";
    }


    return {

        status: overallStatus,

        components: {

            cpu: {
                usagePercent: cpuUsage,
                status: cpuStatus
            },

            memory: {
                usagePercent: memoryUsage,
                status: memoryStatus
            },

            load: {
                oneMinute: loadAverage,
                normalizedPercent:
                    Number(loadPercent.toFixed(2)),
                status: loadStatus
            },

            disk: {
                total: disks.length,
                warning: warningDisks.length,
                critical: criticalDisks.length,
                status: diskStatus
            }

        },

        checkedAt: new Date().toISOString()
    };
}



module.exports = {
    getSystemInfo,
    getDashboardOverview,
    getDiskUsage,
    getSystemHealth
};