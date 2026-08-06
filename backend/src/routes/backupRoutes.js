const express = require("express");

const backupController =
    require("../controllers/backupController");

const router = express.Router();


router.get(
    "/",
    backupController.getBackups
);


router.get(
    "/:filename",
    backupController.getBackupByFilename
);


router.post(
    "/",
    backupController.createBackup
);


module.exports = router;