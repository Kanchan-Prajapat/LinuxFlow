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
    "/zones/:zone",
    firewallController.getZoneDetails
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

module.exports = router;