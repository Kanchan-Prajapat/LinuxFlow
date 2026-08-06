const express = require("express");

const permissionController =
    require("../controllers/permissionController");

const router = express.Router();


router.get(
    "/",
    permissionController.getPermissions
);

router.patch(
    "/mode",
    permissionController.changePermissions
);

router.patch(
    "/owner",
    permissionController.changeOwnership
);

module.exports = router;