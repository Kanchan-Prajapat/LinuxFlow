const express = require("express");

const aclController =
    require("../controllers/aclController");

const router = express.Router();


router.get(
    "/",
    aclController.getAcl
);


module.exports = router;