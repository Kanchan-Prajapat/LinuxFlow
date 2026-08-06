const express = require("express");

const serviceController =
    require("../controllers/serviceController");

const router = express.Router();


router.get(
    "/",
    serviceController.getServices
);

router.get(
    "/:name",
    serviceController.getServiceByName
);


module.exports = router;