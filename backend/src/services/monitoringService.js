const { execFile } = require("child_process");
const { promisify } = require("util");


const execFileAsync = promisify(execFile);
const systemService =
    require("./systemService");

async function runCommand(command, args = []) {

    const { stdout } =
        await execFileAsync(
            command,
            args,
            {
                timeout: 10000,
                maxBuffer: 5 * 1024 * 1024
            }
        );

    return stdout.trim();
}


// ########################################################
// Process Summary
// ########################################################

async function getProcessSummary() {

    const stdout =
        await runCommand(
            "ps",
            [
                "-eo",
                "stat="
            ]
        );


    const states =
        stdout
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);


    let running = 0;
    let sleeping = 0;
    let stopped = 0;
    let zombie = 0;


    for (const state of states) {

        const type = state[0];

        switch (type) {

            case "R":
                running++;
                break;

            case "S":
            case "D":
            case "I":
                sleeping++;
                break;

            case "T":
            case "t":
                stopped++;
                break;

            case "Z":
                zombie++;
                break;
        }
    }


    return {
        total: states.length,
        running,
        sleeping,
        stopped,
        zombie
    };
}


// ########################################################
// Top CPU Processes
// ########################################################

async function getTopCpuProcesses(limit = 5) {

    const stdout =
        await runCommand(
            "ps",
            [
                "-eo",
                "pid,user,comm,%cpu,%mem",
                "--sort=-%cpu"
            ]
        );


    return parseProcessOutput(
        stdout,
        limit
    );
}


// ########################################################
// Top Memory Processes
// ########################################################

async function getTopMemoryProcesses(limit = 5) {

    const stdout =
        await runCommand(
            "ps",
            [
                "-eo",
                "pid,user,comm,%cpu,%mem",
                "--sort=-%mem"
            ]
        );


    return parseProcessOutput(
        stdout,
        limit
    );
}


// ########################################################
// Process Parser
// ########################################################

function parseProcessOutput(
    stdout,
    limit
) {

    const lines =
        stdout
            .split("\n")
            .slice(1)
            .filter(Boolean)
            .slice(0, limit);


    return lines.map(line => {

        const parts =
            line.trim()
                .split(/\s+/);


        const [
            pid,
            user,
            command,
            cpu,
            memory
        ] = parts;


        return {
            pid: Number(pid),
            user,
            command,
            cpuPercent:
                Number(cpu),
            memoryPercent:
                Number(memory)
        };
    });
}


// ########################################################
// Monitoring Overview
// ########################################################

async function getMonitoringOverview() {

    const [
        processes,
        topCpu,
        topMemory
    ] =
        await Promise.all([
            getProcessSummary(),
            getTopCpuProcesses(),
            getTopMemoryProcesses()
        ]);


    return {
        processes,

        topProcesses: {
            cpu: topCpu,
            memory: topMemory
        },

        checkedAt:
            new Date().toISOString()
    };
}


// ########################################################
// Process List
// ########################################################

async function getProcesses({
    search = "",
    limit = 50
} = {}) {

    const safeLimit =
        Math.min(
            Math.max(Number(limit) || 50, 1),
            200
        );


    const stdout =
        await runCommand(
            "ps",
            [
                "-eo",
                "pid=,ppid=,user=,stat=,comm=,%cpu=,%mem=,etime="
            ]
        );


    let processes =
        stdout
            .split("\n")
            .filter(line => line.trim())
            .map(line => {

                const parts =
                    line.trim().split(/\s+/);


                const [
                    pid,
                    ppid,
                    user,
                    state,
                    command,
                    cpu,
                    memory,
                    elapsed
                ] = parts;


                return {
                    pid: Number(pid),
                    ppid: Number(ppid),
                    user,
                    state,
                    command,
                    cpuPercent: Number(cpu),
                    memoryPercent: Number(memory),
                    elapsed
                };
            });


    if (search) {

        const query =
            String(search)
                .toLowerCase();


        processes =
            processes.filter(process =>

                process.command
                    .toLowerCase()
                    .includes(query)

                ||

                process.user
                    .toLowerCase()
                    .includes(query)

                ||

                String(process.pid)
                    .includes(query)
            );
    }


    return processes.slice(
        0,
        safeLimit
    );
}


// ########################################################
// Process Details
// ########################################################

async function getProcessByPid(pid) {

    const processId =
        Number(pid);


    if (
        !Number.isInteger(processId) ||
        processId <= 0
    ) {

        return {
            success: false,
            type: "invalid-pid",
            message:
                "PID must be a positive integer"
        };
    }


    let stdout = "";


    try {

        stdout =
            await runCommand(
                "ps",
                [
                    "-p",
                    String(processId),

                    "-o",
                    "pid=,ppid=,user=,stat=,comm=,%cpu=,%mem=,etime=,lstart="
                ]
            );

    } catch (_) {

        return {
            success: false,
            type: "not-found",
            message:
                `Process ${processId} was not found`
        };
    }


    if (!stdout) {

        return {
            success: false,
            type: "not-found",
            message:
                `Process ${processId} was not found`
        };
    }


    const parts =
        stdout.trim()
            .split(/\s+/);


    /*
     * lstart produces:
     *
     * Mon Aug 7 21:10:20 2026
     *
     * So the final 5 fields belong to startedAt.
     */

    const [
        processPid,
        ppid,
        user,
        state,
        command,
        cpu,
        memory,
        elapsed,
        ...startParts
    ] = parts;


    return {
        success: true,

        data: {
            pid: Number(processPid),
            ppid: Number(ppid),
            user,
            state,
            command,

            cpuPercent:
                Number(cpu),

            memoryPercent:
                Number(memory),

            elapsed,

            startedAt:
                startParts.join(" ")
        }
    };
}




// ########################################################
// Process Action Protection
// ########################################################

const PROTECTED_PROCESS_NAMES =
    new Set([
        "systemd",
        "init",
        "sshd"
    ]);


async function inspectProcessForAction(pid) {

    const processId =
        Number(pid);


    if (
        !Number.isInteger(processId) ||
        processId <= 0
    ) {

        return {
            success: false,
            type: "invalid-pid",
            message:
                "PID must be a positive integer"
        };
    }


    // PID 1 must never be managed through LinuxFlow.
    if (processId === 1) {

        return {
            success: false,
            type: "protected-process",
            message:
                "PID 1 is a protected system process"
        };
    }


    // Never kill LinuxFlow's own backend process.
    if (processId === process.pid) {

        return {
            success: false,
            type: "protected-process",
            message:
                "LinuxFlow backend process cannot terminate itself"
        };
    }


    const result =
        await getProcessByPid(
            processId
        );


    if (!result.success) {
        return result;
    }


    const processInfo =
        result.data;


    if (
        PROTECTED_PROCESS_NAMES.has(
            processInfo.command
        )
    ) {

        return {
            success: false,
            type: "protected-process",
            message:
                `Process '${processInfo.command}' is protected by LinuxFlow`
        };
    }


    return {
        success: true,
        data: processInfo
    };
}



// ########################################################
// Terminate Process
// ########################################################

async function terminateProcess(pid) {

    const inspection =
        await inspectProcessForAction(
            pid
        );


    if (!inspection.success) {
        return inspection;
    }


    const processId =
        inspection.data.pid;


    try {

        process.kill(
            processId,
            "SIGTERM"
        );


    } catch (error) {

        if (error.code === "ESRCH") {

            return {
                success: false,
                type: "not-found",
                message:
                    `Process ${processId} no longer exists`
            };
        }


        if (error.code === "EPERM") {

            return {
                success: false,
                type: "permission-denied",
                message:
                    `Permission denied while terminating process ${processId}`
            };
        }


        throw error;
    }


    // Give process time to exit gracefully.
    await new Promise(resolve =>
        setTimeout(resolve, 500)
    );


    let stillRunning = true;


    try {

        process.kill(
            processId,
            0
        );

    } catch (error) {

        if (error.code === "ESRCH") {
            stillRunning = false;
        } else {
            throw error;
        }
    }


    return {
        success: true,

        data: {
            pid: processId,
            command:
                inspection.data.command,

            signal: "SIGTERM",

            stillRunning
        }
    };
}

// ########################################################
// Force Kill Process
// ########################################################

async function killProcess(pid) {

    const inspection =
        await inspectProcessForAction(
            pid
        );


    if (!inspection.success) {
        return inspection;
    }


    const processId =
        inspection.data.pid;


    try {

        process.kill(
            processId,
            "SIGKILL"
        );


    } catch (error) {

        if (error.code === "ESRCH") {

            return {
                success: false,
                type: "not-found",
                message:
                    `Process ${processId} no longer exists`
            };
        }


        if (error.code === "EPERM") {

            return {
                success: false,
                type: "permission-denied",
                message:
                    `Permission denied while killing process ${processId}`
            };
        }


        throw error;
    }


    await new Promise(resolve =>
        setTimeout(resolve, 300)
    );


    return {
        success: true,

        data: {
            pid: processId,
            command:
                inspection.data.command,
            signal: "SIGKILL"
        }
    };
}


// ########################################################
// Monitoring Alerts
// ########################################################

async function getMonitoringAlerts() {

    const [
        overview,
        disks,
        processes
    ] =
        await Promise.all([
            systemService.getDashboardOverview(),
            systemService.getDiskUsage(),
            getProcessSummary()
        ]);


    const alerts = [];


    // ####################################################
    // CPU
    // ####################################################

    const cpuUsage =
        overview.cpu.usagePercent;


    if (cpuUsage >= 90) {

        alerts.push({
            type: "cpu",
            severity: "critical",
            message:
                `CPU usage is critically high at ${cpuUsage}%`,
            value: cpuUsage,
            threshold: 90
        });

    } else if (cpuUsage >= 70) {

        alerts.push({
            type: "cpu",
            severity: "warning",
            message:
                `CPU usage is high at ${cpuUsage}%`,
            value: cpuUsage,
            threshold: 70
        });
    }


    // ####################################################
    // Memory
    // ####################################################

    const memoryUsage =
        overview.memory.usagePercent;


    if (memoryUsage >= 90) {

        alerts.push({
            type: "memory",
            severity: "critical",
            message:
                `Memory usage is critically high at ${memoryUsage}%`,
            value: memoryUsage,
            threshold: 90
        });

    } else if (memoryUsage >= 75) {

        alerts.push({
            type: "memory",
            severity: "warning",
            message:
                `Memory usage is high at ${memoryUsage}%`,
            value: memoryUsage,
            threshold: 75
        });
    }


    // ####################################################
    // Load Average
    // ####################################################

    const oneMinuteLoad =
        overview.cpu.loadAverage[0];

    const cores =
        overview.cpu.cores;


    const loadPercent =
        cores > 0
            ? (oneMinuteLoad / cores) * 100
            : 0;


    if (loadPercent >= 100) {

        alerts.push({
            type: "load",
            severity: "critical",
            message:
                `System load is critically high at ${loadPercent.toFixed(2)}% of CPU capacity`,
            value:
                Number(loadPercent.toFixed(2)),
            threshold: 100
        });

    } else if (loadPercent >= 70) {

        alerts.push({
            type: "load",
            severity: "warning",
            message:
                `System load is high at ${loadPercent.toFixed(2)}% of CPU capacity`,
            value:
                Number(loadPercent.toFixed(2)),
            threshold: 70
        });
    }


    // ####################################################
    // Disk
    // ####################################################

    for (const disk of disks) {

        if (disk.usagePercent >= 90) {

            alerts.push({
                type: "disk",
                severity: "critical",

                message:
                    `Disk '${disk.mountPoint}' is critically full at ${disk.usagePercent}%`,

                mountPoint:
                    disk.mountPoint,

                value:
                    disk.usagePercent,

                threshold: 90
            });

        } else if (
            disk.usagePercent >= 70
        ) {

            alerts.push({
                type: "disk",
                severity: "warning",

                message:
                    `Disk '${disk.mountPoint}' usage is high at ${disk.usagePercent}%`,

                mountPoint:
                    disk.mountPoint,

                value:
                    disk.usagePercent,

                threshold: 70
            });
        }
    }


    // ####################################################
    // Zombie Processes
    // ####################################################

    if (processes.zombie > 0) {

        alerts.push({
            type: "process",
            severity:
                processes.zombie >= 5
                    ? "critical"
                    : "warning",

            message:
                `${processes.zombie} zombie process(es) detected`,

            value:
                processes.zombie,

            threshold: 1
        });
    }


    // ####################################################
    // Overall alert state
    // ####################################################

    let status = "healthy";


    if (
        alerts.some(
            alert =>
                alert.severity ===
                "critical"
        )
    ) {

        status = "critical";

    } else if (alerts.length > 0) {

        status = "warning";
    }


    return {
        status,

        count:
            alerts.length,

        alerts,

        checkedAt:
            new Date().toISOString()
    };
}

module.exports = {
    getProcessSummary,
    getTopCpuProcesses,
    getTopMemoryProcesses,
    getMonitoringOverview,
    
    getProcesses,
    getProcessByPid,
     inspectProcessForAction,
    terminateProcess,
    killProcess,

    getMonitoringAlerts,
    
};