const express = require("express");

const processController =
    require("../controllers/processController");

const router = express.Router();


router.get(
    "/",
    processController.getProcesses
);

router.get(
    "/:pid",
    processController.getProcessByPid
);

router.post(
    "/:pid/terminate",
    processController.terminateProcess
);

module.exports = router;