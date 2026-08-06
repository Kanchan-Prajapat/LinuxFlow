const processService =
    require("../services/processService");


async function getProcesses(req, res) {

    try {

        const processes =
            await processService.getProcesses();

        return res.status(200).json({
            success: true,
            count: processes.length,
            data: processes
        });

    } catch (error) {

        console.error(
            "Process list error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve processes"
        });
    }
}


async function getProcessByPid(req, res) {

    try {

        const { pid } = req.params;

        if (!/^\d+$/.test(pid) || Number(pid) <= 0) {

            return res.status(400).json({
                success: false,
                message: "Invalid process ID"
            });
        }

        const process =
            await processService.getProcessByPid(pid);

        if (!process) {

            return res.status(404).json({
                success: false,
                message: `Process with PID ${pid} not found`
            });
        }

        return res.status(200).json({
            success: true,
            data: process
        });

    } catch (error) {

        console.error(
            "Process information error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve process information"
        });
    }
}


module.exports = {
    getProcesses,
    getProcessByPid
};