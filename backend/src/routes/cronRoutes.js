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


router.patch(
    "/managed/:id/status",
    cronController.setJobStatus
);


router.delete(
    "/managed/:id",
    cronController.deleteJob
);

module.exports =
    router;