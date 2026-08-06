const express = require("express");

const groupController =
    require("../controllers/groupController");

const router = express.Router();


router.post(
    "/",
    groupController.createGroup
);

router.post(
    "/:groupName/members",
    groupController.addGroupMember
);

router.delete(
    "/:groupName/members/:username",
    groupController.removeGroupMember
);

router.delete(
    "/:groupName",
    groupController.deleteGroup
);


router.get(
    "/",
    groupController.getGroups
);

router.get(
    "/:groupName",
    groupController.getGroupByName
);


module.exports = router;