const processService =
    require("../services/processService");


async function getProcesses(req, res) {

    try {

        let processes =
            await processService.getProcesses();

        const {
            search,
            sort,
            limit
        } = req.query;


        // Search by command/user/PID
        if (search) {

            const term =
                String(search).toLowerCase();

            processes = processes.filter(process =>

                process.command
                    .toLowerCase()
                    .includes(term) ||

                process.user
                    .toLowerCase()
                    .includes(term) ||

                String(process.pid) === term
            );
        }


        // Sorting
        if (sort === "cpu") {

            processes.sort(
                (a, b) =>
                    b.cpuPercent - a.cpuPercent
            );

        } else if (sort === "memory") {

            processes.sort(
                (a, b) =>
                    b.memoryPercent - a.memoryPercent
            );

        } else if (sort === "pid") {

            processes.sort(
                (a, b) =>
                    a.pid - b.pid
            );
        }


        // Limit
        if (limit !== undefined) {

            const parsedLimit =
                Number(limit);

            if (
                !Number.isInteger(parsedLimit) ||
                parsedLimit <= 0 ||
                parsedLimit > 100
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Limit must be an integer between 1 and 100"
                });
            }

            processes =
                processes.slice(0, parsedLimit);
        }


        return res.status(200).json({
            success: true,
            count: processes.length,

            filters: {
                search: search || null,
                sort: sort || null,
                limit: limit
                    ? Number(limit)
                    : null
            },

            data: processes
        });

    } catch (error) {

        console.error(
            "Process list error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve processes"
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


async function terminateProcess(req, res) {

    try {

        const { pid } = req.params;


        if (
            !/^\d+$/.test(pid) ||
            Number(pid) <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid process ID"
            });
        }


        const result =
            await processService
                .terminateProcess(pid);


        if (!result.success) {

            if (
                result.reason ===
                "Process not found"
            ) {

                return res.status(404).json({
                    success: false,
                    message: result.reason
                });
            }


            return res.status(403).json({
                success: false,
                message: result.reason
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `Process ${pid} terminated successfully`,
            data: result.process
        });


    } catch (error) {

        console.error(
            "Process termination error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to terminate process"
        });
    }
}

module.exports = {
    getProcesses,
    getProcessByPid,
    terminateProcess
};