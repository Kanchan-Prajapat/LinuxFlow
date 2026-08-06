const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);


async function getProcesses() {

    const { stdout } = await execFileAsync(
        "ps",
        [
            "-eo",
            "pid=,ppid=,user=,%cpu=,%mem=,stat=,comm="
        ]
    );

    const lines = stdout
        .trim()
        .split("\n");

    const processes = [];

    for (const line of lines) {

        const parts = line.trim().split(/\s+/);

        if (parts.length < 7) {
            continue;
        }

        const [
            pid,
            ppid,
            user,
            cpu,
            memory,
            state,
            ...commandParts
        ] = parts;

        processes.push({
            pid: Number(pid),
            ppid: Number(ppid),
            user,
            cpuPercent: Number(cpu),
            memoryPercent: Number(memory),
            state,
            command: commandParts.join(" ")
        });
    }

    return processes;
}


async function getProcessByPid(pid) {

    if (!/^\d+$/.test(String(pid))) {
        return null;
    }

    try {

        const { stdout } = await execFileAsync(
            "ps",
            [
                "-p",
                String(pid),
                "-o",
                "pid=,ppid=,user=,%cpu=,%mem=,stat=,etime=,comm="
            ]
        );

        const line = stdout.trim();

        if (!line) {
            return null;
        }

        const parts = line.split(/\s+/);

        const [
            processId,
            parentId,
            user,
            cpu,
            memory,
            state,
            elapsed,
            ...commandParts
        ] = parts;

        return {
            pid: Number(processId),
            ppid: Number(parentId),
            user,
            cpuPercent: Number(cpu),
            memoryPercent: Number(memory),
            state,
            elapsed,
            command: commandParts.join(" ")
        };

    } catch (error) {

        // ps returns non-zero when PID doesn't exist
        if (error.code === 1) {
            return null;
        }

        throw error;
    }
}


function isProcessRunning(pid) {

    try {
        process.kill(Number(pid), 0);
        return true;
    } catch (error) {

        if (error.code === "EPERM") {
            return true;
        }

        return false;
    }
}


function wait(milliseconds) {

    return new Promise(resolve =>
        setTimeout(resolve, milliseconds)
    );
}


async function validateProcessTermination(pid) {

    const numericPid = Number(pid);

    const processInfo =
        await getProcessByPid(numericPid);

    if (!processInfo) {

        return {
            allowed: false,
            reason: "Process not found"
        };
    }


    // Protect PID 1
    if (numericPid === 1) {

        return {
            allowed: false,
            reason:
                "System initialization process cannot be terminated"
        };
    }


    // Protect LinuxFlow backend itself
    if (numericPid === process.pid) {

        return {
            allowed: false,
            reason:
                "LinuxFlow cannot terminate its own backend process"
        };
    }


    // Protect backend parent process
    if (numericPid === process.ppid) {

        return {
            allowed: false,
            reason:
                "LinuxFlow backend parent process is protected"
        };
    }


    const protectedProcesses = new Set([
        "systemd",
        "init",
        "systemd-journald",
        "systemd-logind",
        "dbus-daemon",
        "NetworkManager",
        "sshd"
    ]);


    if (
        protectedProcesses.has(
            processInfo.command
        )
    ) {

        return {
            allowed: false,
            reason:
                `'${processInfo.command}' is a protected system process`
        };
    }


    return {
        allowed: true,
        process: processInfo
    };
}


async function terminateProcess(pid) {

    const numericPid = Number(pid);

    const validation =
        await validateProcessTermination(
            numericPid
        );

    if (!validation.allowed) {

        return {
            success: false,
            reason: validation.reason
        };
    }


    try {

        process.kill(
            numericPid,
            "SIGTERM"
        );

    } catch (error) {

        if (error.code === "ESRCH") {

            return {
                success: false,
                reason: "Process no longer exists"
            };
        }

        if (error.code === "EPERM") {

            return {
                success: false,
                reason:
                    "Permission denied while terminating process"
            };
        }

        throw error;
    }


    // Allow process time for graceful shutdown
    await wait(1000);


    const stillRunning =
        isProcessRunning(numericPid);


    if (stillRunning) {

        return {
            success: false,
            reason:
                "Process did not terminate after SIGTERM"
        };
    }


    return {
        success: true,
        process: validation.process
    };
}

module.exports = {
    getProcesses,
    getProcessByPid,
    terminateProcess
};