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


router.post(
    "/:filename/restore",
    backupController.restoreBackup
);


router.delete(
    "/:filename",
    backupController.deleteBackup
);

module.exports = router;