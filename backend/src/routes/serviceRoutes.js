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

router.post(
    "/:name/start",
    (req, res, next) => {
        req.action = "start";
        next();
    },
    serviceController.manageService
);


router.post(
    "/:name/stop",
    (req, res, next) => {
        req.action = "stop";
        next();
    },
    serviceController.manageService
);


router.post(
    "/:name/restart",
    (req, res, next) => {
        req.action = "restart";
        next();
    },
    serviceController.manageService
);

module.exports = router;