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


router.post(
    "/devices/inspect",
    lvmController.inspectDevice
);


router.post(
    "/pvs",
    lvmController.createPhysicalVolume
);

router.post(
    "/vgs",
    lvmController.createVolumeGroup
);

router.post(
    "/lvs",
    lvmController.createLogicalVolume
);

router.delete(
    "/lvs",
    lvmController.removeLogicalVolume
);

router.delete(
    "/vgs",
    lvmController.removeVolumeGroup
);

router.delete(
    "/pvs",
    lvmController.removePhysicalVolume
);

module.exports = router;