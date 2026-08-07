const express =
    require("express");

const monitoringController =
    require("../controllers/monitoringController");


const router =
    express.Router();


router.get(
    "/",
    monitoringController.getOverview
);


router.get(
    "/processes",
    monitoringController.getProcesses
);


router.get(
    "/processes/:pid",
    monitoringController.getProcessDetails
);


router.post(
    "/processes/:pid/terminate",
    monitoringController.terminateProcess
);


router.post(
    "/processes/:pid/kill",
    monitoringController.forceKillProcess
);


router.get(
    "/alerts",
    monitoringController.getAlerts
);

module.exports = router;