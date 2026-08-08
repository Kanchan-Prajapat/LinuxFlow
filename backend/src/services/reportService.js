const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPORT_DIRECTORY =
    "/var/lib/linuxflow/reports";

const REPORT_EXPORT_DIRECTORY =
    "/var/lib/linuxflow/reports/exports";

const systemService =
    require("./systemService");

const monitoringService =
    require("./monitoringService");

const lvmService =
    require("./lvmService");

const swapService =
    require("./swapService");

const serviceService =
    require("./serviceService");

const firewallService =
    require("./firewallService");

const sshService =
    require("./sshService");

// ########################################################
// LinuxFlow Report
// ########################################################

async function generateSystemReport() {

    const report = {
        generatedAt:
            new Date().toISOString()
    };


    // ####################################################
    // System
    // ####################################################

    try {

        report.system =
            await systemService
                .getSystemInfo();

    } catch (error) {

        report.system = {
            error:
                "Unable to retrieve system information"
        };
    }


    // ####################################################
    // Dashboard Overview
    // ####################################################

    try {

        report.overview =
            await systemService
                .getDashboardOverview();

    } catch (error) {

        report.overview = {
            error:
                "Unable to retrieve dashboard overview"
        };
    }


    // ####################################################
    // Disk
    // ####################################################

    try {

        report.disk =
            await systemService
                .getDiskUsage();

    } catch (error) {

        report.disk = {
            error:
                "Unable to retrieve disk usage"
        };
    }


    // ####################################################
    // System Health
    // ####################################################

    try {

        report.health =
            await systemService
                .getSystemHealth();

    } catch (error) {

        report.health = {
            error:
                "Unable to determine system health"
        };
    }


    // ####################################################
    // Monitoring
    // ####################################################

    try {

        report.monitoring =
            await monitoringService
                .getMonitoringOverview();

    } catch (error) {

        report.monitoring = {
            error:
                "Unable to retrieve monitoring information"
        };
    }


    // ####################################################
    // Monitoring Alerts
    // ####################################################

    try {

        report.alerts =
            await monitoringService
                .getMonitoringAlerts();

    } catch (error) {

        report.alerts = {
            error:
                "Unable to retrieve monitoring alerts"
        };
    }

// ####################################################
// LVM
// ####################################################

try {

    const [
        physicalVolumes,
        volumeGroups,
        logicalVolumes,
        overview
    ] = await Promise.all([
        lvmService.getPhysicalVolumes(),
        lvmService.getVolumeGroups(),
        lvmService.getLogicalVolumes(),
        lvmService.getLvmOverview()
    ]);


    report.lvm = {
        overview,
        physicalVolumes,
        volumeGroups,
        logicalVolumes
    };

} catch (error) {

    console.error(
        "Report LVM error:",
        error
    );

    report.lvm = {
        error:
            "Unable to retrieve LVM information"
    };
}

// ####################################################
// Swap
// ####################################################

try {

    report.swap =
        await swapService.getSwapInfo();

} catch (error) {

    console.error(
        "Report Swap error:",
        error
    );

    report.swap = {
        error:
            "Unable to retrieve swap information"
    };
}

// ####################################################
// Services
// ####################################################

try {

    report.services =
        await serviceService.getServices();

} catch (error) {

    console.error(
        "Report Services error:",
        error
    );

    report.services = {
        error:
            "Unable to retrieve service information"
    };
}


// ####################################################
// Firewall
// ####################################################

try {

    const [
        status,
        zones
    ] = await Promise.all([
        firewallService.getFirewallStatus(),
        firewallService.getZones()
    ]);


    report.firewall = {
        status,
        zones
    };

} catch (error) {

    console.error(
        "Report Firewall error:",
        error
    );

    report.firewall = {
        error:
            "Unable to retrieve firewall information"
    };
}

// ####################################################
// SSH
// ####################################################

try {

    const [
        status,
        configuration,
        overview,
        activeSessions
    ] = await Promise.all([
        sshService.getSshStatus(),
        sshService.getSshConfiguration(),
        sshService.getSshOverview(),
        sshService.getActiveSshSessions()
    ]);


    report.ssh = {
        status,
        configuration,
        overview,
        activeSessions
    };

} catch (error) {

    console.error(
        "Report SSH error:",
        error
    );

    report.ssh = {
        error:
            "Unable to retrieve SSH information"
    };
}



    return report;
}


// ########################################################
// Report Directory
// ########################################################

async function ensureReportDirectory() {

    await fs.promises.mkdir(
        REPORT_DIRECTORY,
        {
            recursive: true,
            mode: 0o700
        }
    );
}


// ########################################################
// Save Report
// ########################################################

async function saveReport() {

    const report =
        await generateSystemReport();


    await ensureReportDirectory();


    const id =
        crypto.randomUUID();


    const createdAt =
        new Date().toISOString();


    const filename =
        `linuxflow-report-${id}.json`;


    const filepath =
        path.join(
            REPORT_DIRECTORY,
            filename
        );


    const savedReport = {
        id,
        createdAt,
        filename,
        report
    };


    await fs.promises.writeFile(
        filepath,
        JSON.stringify(
            savedReport,
            null,
            2
        ),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );


    return {
        id,
        filename,
        createdAt,
        path: filepath
    };
}


// ########################################################
// List Reports
// ########################################################

async function listReports() {

    await ensureReportDirectory();


    const filenames =
        await fs.promises.readdir(
            REPORT_DIRECTORY
        );


    const reports = [];


    for (const filename of filenames) {

        if (
            !filename.startsWith(
                "linuxflow-report-"
            )
            ||
            !filename.endsWith(".json")
        ) {
            continue;
        }


        const filepath =
            path.join(
                REPORT_DIRECTORY,
                filename
            );


        try {

            const stat =
                await fs.promises.stat(
                    filepath
                );


            if (!stat.isFile()) {
                continue;
            }


            const content =
                await fs.promises.readFile(
                    filepath,
                    "utf8"
                );


            const savedReport =
                JSON.parse(content);


            reports.push({
                id: savedReport.id,
                filename,
                createdAt:
                    savedReport.createdAt,
                sizeBytes:
                    stat.size
            });


        } catch (error) {

            console.error(
                `Unable to read report '${filename}':`,
                error
            );
        }
    }


    reports.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );


    return reports;
}


// ########################################################
// Get Report
// ########################################################

async function getReport(id) {

    if (
        typeof id !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(id)
    ) {

        return {
            success: false,
            type: "invalid-id",
            message:
                "Invalid report ID"
        };
    }


    const filename =
        `linuxflow-report-${id}.json`;


    const filepath =
        path.join(
            REPORT_DIRECTORY,
            filename
        );


    try {

        const content =
            await fs.promises.readFile(
                filepath,
                "utf8"
            );


        return {
            success: true,
            data:
                JSON.parse(content)
        };


    } catch (error) {

        if (
            error.code ===
            "ENOENT"
        ) {

            return {
                success: false,
                type: "not-found",
                message:
                    `Report '${id}' not found`
            };
        }


        throw error;
    }
}


// ########################################################
// Delete Report
// ########################################################

async function deleteReport(id) {

    if (
        typeof id !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(id)
    ) {

        return {
            success: false,
            type: "invalid-id",
            message:
                "Invalid report ID"
        };
    }


    const filename =
        `linuxflow-report-${id}.json`;


    const filepath =
        path.join(
            REPORT_DIRECTORY,
            filename
        );


    try {

        await fs.promises.unlink(
            filepath
        );


        return {
            success: true,
            data: {
                id,
                filename
            }
        };


    } catch (error) {

        if (
            error.code ===
            "ENOENT"
        ) {

            return {
                success: false,
                type: "not-found",
                message:
                    `Report '${id}' not found`
            };
        }


        throw error;
    }
}

// ########################################################
// Export Report as TXT
// ########################################################

async function exportReportAsText(id) {

    const result =
        await getReport(id);


    if (!result.success) {
        return result;
    }


    await fs.promises.mkdir(
        REPORT_EXPORT_DIRECTORY,
        {
            recursive: true,
            mode: 0o700
        }
    );


    const report =
        result.data.report;


    const lines = [];


    lines.push(
        "============================================================"
    );

    lines.push(
        "                    LINUXFLOW SYSTEM REPORT"
    );

    lines.push(
        "============================================================"
    );

    lines.push(
        `Report ID: ${result.data.id}`
    );

    lines.push(
        `Generated At: ${result.data.createdAt}`
    );

    lines.push("");


    // System
    lines.push(
        "-------------------- SYSTEM --------------------"
    );

    lines.push(
        `Hostname: ${report.system?.hostname ?? "N/A"}`
    );

    lines.push(
        `Platform: ${report.system?.platform ?? "N/A"}`
    );

    lines.push(
        `Architecture: ${report.system?.architecture ?? "N/A"}`
    );

    lines.push(
        `Kernel: ${report.system?.kernel ?? "N/A"}`
    );

    lines.push("");


    // CPU
    lines.push(
        "-------------------- CPU --------------------"
    );

    lines.push(
        `Cores: ${report.overview?.cpu?.cores ?? "N/A"}`
    );

    lines.push(
        `Usage: ${report.overview?.cpu?.usagePercent ?? "N/A"}%`
    );

    lines.push(
        `Load Average: ${
            report.overview?.cpu?.loadAverage?.join(", ")
            ?? "N/A"
        }`
    );

    lines.push("");


    // Memory
    lines.push(
        "-------------------- MEMORY --------------------"
    );

    lines.push(
        `Total: ${report.overview?.memory?.total ?? "N/A"}`
    );

    lines.push(
        `Used: ${report.overview?.memory?.used ?? "N/A"}`
    );

    lines.push(
        `Free: ${report.overview?.memory?.free ?? "N/A"}`
    );

    lines.push(
        `Usage: ${
            report.overview?.memory?.usagePercent
            ?? "N/A"
        }%`
    );

    lines.push("");


    // Health
    lines.push(
        "-------------------- HEALTH --------------------"
    );

    lines.push(
        `Overall Status: ${
            report.health?.status ?? "N/A"
        }`
    );

    lines.push("");


    // Disk
    lines.push(
        "-------------------- DISK --------------------"
    );

    if (Array.isArray(report.disk)) {

        for (const disk of report.disk) {

            lines.push(
                `${disk.mountPoint} | ` +
                `${disk.used} / ${disk.size} | ` +
                `${disk.usagePercent}% | ` +
                `${disk.status}`
            );
        }

    } else {

        lines.push("Disk information unavailable");
    }

    lines.push("");


    // Monitoring
    lines.push(
        "-------------------- MONITORING --------------------"
    );

    lines.push(
        `Processes: ${
            report.monitoring?.processes?.total
            ?? "N/A"
        }`
    );

    lines.push(
        `Running: ${
            report.monitoring?.processes?.running
            ?? "N/A"
        }`
    );

    lines.push(
        `Sleeping: ${
            report.monitoring?.processes?.sleeping
            ?? "N/A"
        }`
    );

    lines.push(
        `Zombie: ${
            report.monitoring?.processes?.zombie
            ?? "N/A"
        }`
    );

    lines.push("");


    // Alerts
    lines.push(
        "-------------------- ALERTS --------------------"
    );

    lines.push(
        `Status: ${
            report.alerts?.status ?? "N/A"
        }`
    );

    lines.push(
        `Count: ${
            report.alerts?.count ?? "N/A"
        }`
    );


    if (
        Array.isArray(
            report.alerts?.alerts
        )
    ) {

        for (
            const alert
            of report.alerts.alerts
        ) {

            lines.push(
                `[${alert.severity}] ${alert.message}`
            );
        }
    }


    lines.push("");

    lines.push(
        "============================================================"
    );

    lines.push(
        "                    END OF REPORT"
    );

    lines.push(
        "============================================================"
    );


    const filename =
        `linuxflow-report-${id}.txt`;


    const filepath =
        path.join(
            REPORT_EXPORT_DIRECTORY,
            filename
        );


    await fs.promises.writeFile(
        filepath,
        lines.join("\n"),
        {
            encoding: "utf8",
            mode: 0o600
        }
    );


    return {
        success: true,

        data: {
            id,
            filename,
            path: filepath
        }
    };
}


// ########################################################
// Export Report as HTML
// ########################################################

async function exportReportAsHtml(id) {

    const result =
        await getReport(id);


    if (!result.success) {
        return result;
    }


    await fs.promises.mkdir(
        REPORT_EXPORT_DIRECTORY,
        {
            recursive: true,
            mode: 0o700
        }
    );


    const report =
        result.data.report;


    const escapeHtml = (value) => {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };


    const diskRows =
        Array.isArray(report.disk)
            ? report.disk.map(disk => `
                <tr>
                    <td>${escapeHtml(disk.mountPoint)}</td>
                    <td>${escapeHtml(disk.size)}</td>
                    <td>${escapeHtml(disk.used)}</td>
                    <td>${escapeHtml(disk.available)}</td>
                    <td>${escapeHtml(disk.usagePercent)}%</td>
                    <td>${escapeHtml(disk.status)}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="6">
                        Disk information unavailable
                    </td>
                </tr>
            `;


    const alerts =
        Array.isArray(report.alerts?.alerts)
            ? report.alerts.alerts.map(alert => `
                <li>
                    <strong>
                        ${escapeHtml(alert.severity)}
                    </strong>
                    -
                    ${escapeHtml(alert.message)}
                </li>
            `).join("")
            : "<li>No alerts</li>";


    const html = `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>LinuxFlow System Report</title>

<style>

body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 30px;
    background: #f5f7fa;
    color: #1f2937;
}

.container {
    max-width: 1100px;
    margin: auto;
}

h1 {
    margin-bottom: 5px;
}

.subtitle {
    color: #6b7280;
    margin-bottom: 30px;
}

.card {
    background: white;
    padding: 20px;
    margin-bottom: 20px;
    border-radius: 10px;
    box-shadow:
        0 2px 8px rgba(0,0,0,0.08);
}

.grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fit, minmax(220px, 1fr));
    gap: 15px;
}

.stat {
    padding: 15px;
    background: #f8fafc;
    border-radius: 8px;
}

.stat strong {
    display: block;
    margin-bottom: 6px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
}

th {
    background: #f8fafc;
}

ul {
    padding-left: 20px;
}

.footer {
    text-align: center;
    color: #6b7280;
    margin-top: 30px;
    font-size: 13px;
}

</style>

</head>


<body>

<div class="container">

<h1>LinuxFlow System Report</h1>

<div class="subtitle">

Report ID:
${escapeHtml(result.data.id)}

<br>

Generated:
${escapeHtml(result.data.createdAt)}

</div>


<!-- SYSTEM -->

<div class="card">

<h2>System</h2>

<div class="grid">

<div class="stat">
<strong>Hostname</strong>
${escapeHtml(report.system?.hostname)}
</div>

<div class="stat">
<strong>Platform</strong>
${escapeHtml(report.system?.platform)}
</div>

<div class="stat">
<strong>Architecture</strong>
${escapeHtml(report.system?.architecture)}
</div>

<div class="stat">
<strong>Kernel</strong>
${escapeHtml(report.system?.kernel)}
</div>

</div>

</div>


<!-- CPU -->

<div class="card">

<h2>CPU</h2>

<div class="grid">

<div class="stat">
<strong>Cores</strong>
${escapeHtml(report.overview?.cpu?.cores)}
</div>

<div class="stat">
<strong>Usage</strong>
${escapeHtml(report.overview?.cpu?.usagePercent)}%
</div>

<div class="stat">
<strong>Load Average</strong>
${escapeHtml(
    report.overview?.cpu?.loadAverage?.join(", ")
)}

</div>

</div>

</div>


<!-- MEMORY -->

<div class="card">

<h2>Memory</h2>

<div class="grid">

<div class="stat">
<strong>Total</strong>
${escapeHtml(report.overview?.memory?.total)}
</div>

<div class="stat">
<strong>Used</strong>
${escapeHtml(report.overview?.memory?.used)}
</div>

<div class="stat">
<strong>Free</strong>
${escapeHtml(report.overview?.memory?.free)}
</div>

<div class="stat">
<strong>Usage</strong>
${escapeHtml(
    report.overview?.memory?.usagePercent
)}%

</div>

</div>

</div>


<!-- HEALTH -->

<div class="card">

<h2>System Health</h2>

<div class="stat">

<strong>Status</strong>

${escapeHtml(
    report.health?.status
)}

</div>

</div>


<!-- DISK -->

<div class="card">

<h2>Disk Usage</h2>

<table>

<thead>

<tr>
<th>Mount Point</th>
<th>Size</th>
<th>Used</th>
<th>Available</th>
<th>Usage</th>
<th>Status</th>
</tr>

</thead>

<tbody>

${diskRows}

</tbody>

</table>

</div>


<!-- MONITORING -->

<div class="card">

<h2>Process Monitoring</h2>

<div class="grid">

<div class="stat">
<strong>Total</strong>
${escapeHtml(
    report.monitoring?.processes?.total
)}
</div>

<div class="stat">
<strong>Running</strong>
${escapeHtml(
    report.monitoring?.processes?.running
)}
</div>

<div class="stat">
<strong>Sleeping</strong>
${escapeHtml(
    report.monitoring?.processes?.sleeping
)}
</div>

<div class="stat">
<strong>Zombie</strong>
${escapeHtml(
    report.monitoring?.processes?.zombie
)}
</div>

</div>

</div>


<!-- ALERTS -->

<div class="card">

<h2>Alerts</h2>

<p>

<strong>Status:</strong>

${escapeHtml(
    report.alerts?.status
)}

</p>

<ul>

${alerts}

</ul>

</div>


<div class="footer">

Generated by LinuxFlow

</div>

</div>

</body>

</html>
`;


    const filename =
        `linuxflow-report-${id}.html`;


    const filepath =
        path.join(
            REPORT_EXPORT_DIRECTORY,
            filename
        );


    await fs.promises.writeFile(
        filepath,
        html,
        {
            encoding: "utf8",
            mode: 0o600
        }
    );


    return {
        success: true,

        data: {
            id,
            filename,
            path: filepath
        }
    };
}

module.exports = {
    generateSystemReport,
    saveReport,
listReports,
getReport,
deleteReport,
exportReportAsText,
exportReportAsHtml
};