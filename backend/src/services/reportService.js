const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPORT_DIRECTORY =
    "/var/lib/linuxflow/reports";

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
        lvmService.getLVMOverview()
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




module.exports = {
    generateSystemReport,
    saveReport,
listReports,
getReport,
deleteReport
};