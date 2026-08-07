const express = require("express");

const swapController =
    require("../controllers/swapController");

const router = express.Router();


router.get(
    "/",
    swapController.getSwap
);


router.post(
    "/files",
    swapController.createSwap
);


router.delete(
    "/files",
    swapController.removeSwap
);


module.exports = router;