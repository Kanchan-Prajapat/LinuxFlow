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


module.exports = {
    getProcesses,
    getProcessByPid
};