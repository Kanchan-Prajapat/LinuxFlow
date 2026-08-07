const express = require("express");

const firewallController =
    require("../controllers/firewallController");

const router = express.Router();


router.get(
    "/status",
    firewallController.getStatus
);


router.get(
    "/zones",
    firewallController.getZones
);




router.get(
    "/services",
    firewallController.getServices
);


router.post(
    "/ports",
    firewallController.addPort
);


router.delete(
    "/ports",
    firewallController.removePort
);


router.post(
    "/services",
    firewallController.addService
);


router.delete(
    "/services",
    firewallController.removeService
);

router.get(
    "/zones/:zone/sync",
    firewallController.getSyncStatus
);


router.get(
    "/zones/:zone",
    firewallController.getZoneDetails
);



router.post(
    "/reload",
    firewallController.reloadFirewall
);



module.exports = router;