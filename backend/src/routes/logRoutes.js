const express =
    require("express");

const logController =
    require("../controllers/logController");


const router =
    express.Router();


// Log statistics
router.get(
    "/stats",
    logController.getLogStats
);


// All logs + filters + pagination
router.get(
    "/",
    logController.getLogs
);


// Recent logs
router.get(
    "/recent",
    logController.getRecentLogs
);


module.exports =
    router;