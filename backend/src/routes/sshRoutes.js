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

router.post(
    "/ports",
    sshController.addPort
);


router.delete(
    "/ports/:port",
    sshController.removePort
);


module.exports =
    router;