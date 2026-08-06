const express = require("express");

const groupController =
    require("../controllers/groupController");

const router = express.Router();


router.get(
    "/",
    groupController.getGroups
);

router.get(
    "/:groupName",
    groupController.getGroupByName
);


module.exports = router;