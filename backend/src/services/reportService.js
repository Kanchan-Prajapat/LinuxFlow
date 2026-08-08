const systemService =
    require("./systemService");

const monitoringService =
    require("./monitoringService");


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


    return report;
}


module.exports = {
    generateSystemReport
};