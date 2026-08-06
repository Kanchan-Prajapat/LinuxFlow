const express = require("express");
const systemController = require("../controllers/systemController");

const router = express.Router();

router.get("/info", systemController.getSystemInfo);

router.get(
    "/overview",
    systemController.getDashboardOverview
);

router.get(
    "/disks",
    systemController.getDiskUsage
);

router.get(
    "/health",
    systemController.getSystemHealth
);

module.exports = router;