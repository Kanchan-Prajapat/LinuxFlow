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


module.exports = {
    generateReport
};