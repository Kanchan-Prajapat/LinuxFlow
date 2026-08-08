const express =
    require("express");

const reportController =
    require("../controllers/reportController");


const router =
    express.Router();


// Generate current report
router.get(
    "/",
    reportController.generateReport
);


// Save current report
router.post(
    "/",
    reportController.saveReport
);


// List saved reports
router.get(
    "/history",
    reportController.listReports
);


// Get one saved report
router.get(
    "/history/:id",
    reportController.getReport
);


// Delete saved report
router.delete(
    "/history/:id",
    reportController.deleteReport
);


module.exports =
    router;