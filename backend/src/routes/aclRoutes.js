const express = require("express");

const aclController =
    require("../controllers/aclController");

const router = express.Router();


router.get(
    "/",
    aclController.getAcl
);

router.patch(
    "/user",
    aclController.setUserAcl
);

router.patch(
    "/group",
    aclController.setGroupAcl
);

router.delete(
    "/user",
    aclController.removeUserAcl
);

router.delete(
    "/group",
    aclController.removeGroupAcl
);

router.delete(
    "/all",
    aclController.removeAllAcl
);


module.exports = router;