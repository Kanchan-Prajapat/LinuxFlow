const logService =
    require("../services/logService");


// ########################################################
// Get All Logs
// ########################################################

async function getLogs(
    req,
    res
) {

    try {

        const {
            user,
            host,
            search,
            limit,
            from,
            to
        } = req.query;


        const logs =
            await logService.getLogs({
                user,
                host,
                search,
                limit,
                from,
                to
            });


        return res.status(200).json({

            success: true,

            count:
                logs.length,

            filters: {
                user:
                    user || null,

                host:
                    host || null,

                search:
                    search || null,

                limit:
                    limit || null,

                from:
                    from || null,

                to:
                    to || null
            },

            data:
                logs
        });


    } catch (error) {

        console.error(
            "Log retrieval error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve logs"
        });
    }
}

// ########################################################
// Get Recent Logs
// ########################################################

async function getRecentLogs(
    req,
    res
) {

    try {

        const limit =
            req.query.limit || 20;


        const logs =
            await logService
                .getRecentLogs(limit);


        return res.status(200).json({

            success: true,

            count:
                logs.length,

            data:
                logs
        });


    } catch (error) {

        console.error(
            "Recent log retrieval error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve recent logs"
        });
    }
}


module.exports = {
    getLogs,
    getRecentLogs
};