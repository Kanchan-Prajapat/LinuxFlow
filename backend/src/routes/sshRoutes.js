const express =
    require("express");

const sshController =
    require("../controllers/sshController");


const router =
    express.Router();


router.get(
    "/",
    sshController.getOverview
);


router.get(
    "/sessions",
    sshController.getSessions
);

router.patch(
    "/configuration",
    sshController.updateSetting
);




module.exports =
    router;