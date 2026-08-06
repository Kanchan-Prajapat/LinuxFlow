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


module.exports = router;