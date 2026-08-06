const express = require("express");
const systemController = require("../controllers/systemController");

const router = express.Router();

router.get("/info", systemController.getSystemInfo);

router.get(
    "/overview",
    systemController.getDashboardOverview
);

module.exports = router;