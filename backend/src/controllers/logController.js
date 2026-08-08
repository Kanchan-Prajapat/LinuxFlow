const logService =
    require("../services/logService");


// ########################################################
// Get Logs
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
            from,
            to,
            page,
            pageSize
        } = req.query;


        const result =
            await logService
                .getPaginatedLogs({

                    user,
                    host,
                    search,
                    from,
                    to,
                    page,
                    pageSize
                });


        return res.status(200).json({

            success: true,

            count:
                result.logs.length,

            filters: {

                user:
                    user || null,

                host:
                    host || null,

                search:
                    search || null,

                from:
                    from || null,

                to:
                    to || null
            },

            pagination:
                result.pagination,

            data:
                result.logs
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
// Get Log Statistics
// ########################################################

async function getLogStats(
    req,
    res
) {

    try {

        const stats =
            await logService
                .getLogStats();


        return res.status(200).json({

            success: true,

            data:
                stats
        });


    } catch (error) {

        console.error(
            "Log statistics error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to retrieve log statistics"
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


// ########################################################
// Exports
// ########################################################

module.exports = {
    getLogs,
    getRecentLogs,
    getLogStats
};