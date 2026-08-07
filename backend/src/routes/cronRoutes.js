const express =
    require("express");

const cronController =
    require("../controllers/cronController");


const router =
    express.Router();


router.get(
    "/",
    cronController.getOverview
);


router.get(
    "/managed",
    cronController.getManagedJobs
);


router.post(
    "/managed",
    cronController.createJob
);

module.exports =
    router;