const reportService =
    require("../services/reportService");


// ########################################################
// Generate System Report
// ########################################################

async function generateReport(
    req,
    res
) {

    try {

        const report =
            await reportService
                .generateSystemReport();


        return res.status(200).json({
            success: true,
            data: report
        });


    } catch (error) {

        console.error(
            "Report generation error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to generate system report"
        });
    }
}

// ########################################################
// Save Report
// ########################################################

async function saveReport(
    req,
    res
) {

    try {

        const result =
            await reportService
                .saveReport();


        return res.status(201).json({
            success: true,
            message:
                "Report saved successfully",
            data: result
        });


    } catch (error) {

        console.error(
            "Report save error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to save report"
        });
    }
}


// ########################################################
// List Reports
// ########################################################

async function listReports(
    req,
    res
) {

    try {

        const reports =
            await reportService
                .listReports();


        return res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        });


    } catch (error) {

        console.error(
            "Report list error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve reports"
        });
    }
}


// ########################################################
// Get Report
// ########################################################

async function getReport(
    req,
    res
) {

    try {

        const result =
            await reportService
                .getReport(
                    req.params.id
                );


        if (!result.success) {

            const status =
                result.type ===
                "invalid-id"
                    ? 400
                    : 404;


            return res.status(status).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Report retrieval error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve report"
        });
    }
}


// ########################################################
// Delete Report
// ########################################################

async function deleteReport(
    req,
    res
) {

    try {

        const { id } =
            req.params;

        const { confirmation } =
            req.body;


        const requiredConfirmation =
            `DELETE REPORT ${id}`;


        if (
            confirmation !==
            requiredConfirmation
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid report deletion confirmation",
                requiredConfirmation
            });
        }


        const result =
            await reportService
                .deleteReport(id);


        if (!result.success) {

            const status =
                result.type ===
                "invalid-id"
                    ? 400
                    : 404;


            return res.status(status).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                "Report deleted successfully",
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Report deletion error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to delete report"
        });
    }
}


async function exportReportAsText(
    req,
    res
) {

    try {

        const result =
            await reportService
                .exportReportAsText(
                    req.params.id
                );


        if (!result.success) {

            return res.status(
                result.type === "invalid-id"
                    ? 400
                    : 404
            ).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                "Report exported successfully",
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "Report export error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to export report"
        });
    }
}


async function exportReportAsHtml(
    req,
    res
) {

    try {

        const result =
            await reportService
                .exportReportAsHtml(
                    req.params.id
                );


        if (!result.success) {

            return res.status(
                result.type === "invalid-id"
                    ? 400
                    : 404
            ).json({
                success: false,
                message:
                    result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                "Report exported successfully",
            data:
                result.data
        });


    } catch (error) {

        console.error(
            "HTML report export error:",
            error
        );


        return res.status(500).json({
            success: false,
            message:
                "Unable to export HTML report"
        });
    }
}



module.exports = {
    generateReport,
    saveReport,
    listReports,
    getReport,
    deleteReport,
    exportReportAsText,
      exportReportAsHtml
};