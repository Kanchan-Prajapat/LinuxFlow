const express = require("express");

const lvmController =
    require("../controllers/lvmController");

const router = express.Router();


router.get(
    "/overview",
    lvmController.getOverview
);


router.get(
    "/pvs",
    lvmController.getPhysicalVolumes
);


router.get(
    "/vgs",
    lvmController.getVolumeGroups
);


router.get(
    "/lvs",
    lvmController.getLogicalVolumes
);


module.exports = router;