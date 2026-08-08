const express =
    require("express");

const logController =
    require("../controllers/logController");


const router =
    express.Router();


// All logs
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