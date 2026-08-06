const express = require("express");

const userController =
    require("../controllers/userController");

const router = express.Router();

router.post(
    "/",
    userController.createUser
);


router.post(
    "/:username/lock",
    (req, res, next) => {
        req.action = "lock";
        next();
    },
    userController.changeUserLockState
);


router.post(
    "/:username/unlock",
    (req, res, next) => {
        req.action = "unlock";
        next();
    },
    userController.changeUserLockState
);


router.get(
    "/",
    userController.getUsers
);

router.get(
    "/:username",
    userController.getUserByUsername
);

router.delete(
    "/:username",
    userController.deleteUser
);

module.exports = router;