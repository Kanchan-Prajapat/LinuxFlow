const userService =
    require("../services/userService");


async function getUsers(req, res) {

    try {

        let users =
            await userService.getUsers();

        const {
            search,
            type,
            limit
        } = req.query;


        // Search
        if (search) {

            const term =
                String(search).toLowerCase();

            users = users.filter(user =>

                user.username
                    .toLowerCase()
                    .includes(term) ||

                user.fullName
                    .toLowerCase()
                    .includes(term) ||

                String(user.uid) === term
            );
        }


        // User type filter
        if (type) {

            const validTypes = [
                "root",
                "system",
                "regular"
            ];

            if (!validTypes.includes(type)) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid user type. Use root, system or regular"
                });
            }

            users = users.filter(
                user => user.type === type
            );
        }


        // Limit
        if (limit !== undefined) {

            const parsedLimit =
                Number(limit);

            if (
                !Number.isInteger(parsedLimit) ||
                parsedLimit <= 0 ||
                parsedLimit > 200
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Limit must be an integer between 1 and 200"
                });
            }

            users =
                users.slice(0, parsedLimit);
        }


        return res.status(200).json({
            success: true,
            count: users.length,

            filters: {
                search: search || null,
                type: type || null,
                limit:
                    limit !== undefined
                        ? Number(limit)
                        : null
            },

            data: users
        });


    } catch (error) {

        console.error(
            "User list error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve users"
        });
    }
}


async function getUserByUsername(req, res) {

    try {

        const { username } = req.params;


        if (
            !/^[a-zA-Z0-9_.-]+$/.test(username)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid username"
            });
        }


        const user =
            await userService
                .getUserByUsername(username);


        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    `User '${username}' not found`
            });
        }


        return res.status(200).json({
            success: true,
            data: user
        });


    } catch (error) {

        console.error(
            "User information error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve user information"
        });
    }
}


async function createUser(req, res) {

    try {

        const {
            username,
            fullName = "",
            shell = "/bin/bash",
            createHome = true
        } = req.body;


        if (
            typeof username !== "string" ||
            !/^[a-z_][a-z0-9_-]{0,31}$/.test(username)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid username"
            });
        }


        if (
            typeof fullName !== "string" ||
            fullName.length > 100 ||
            fullName.includes(":") ||
            /[\r\n]/.test(fullName)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid full name"
            });
        }


        const allowedShells = [
            "/bin/bash",
            "/bin/sh",
            "/sbin/nologin"
        ];

        if (!allowedShells.includes(shell)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid or unsupported shell"
            });
        }


        if (typeof createHome !== "boolean") {

            return res.status(400).json({
                success: false,
                message:
                    "createHome must be true or false"
            });
        }


        const result =
            await userService.createUser({
                username,
                fullName,
                shell,
                createHome
            });


        if (!result.success) {

            if (result.type === "exists") {

                return res.status(409).json({
                    success: false,
                    message: result.message
                });
            }


            return res.status(500).json({
                success: false,
                message: result.message
            });
        }


        return res.status(201).json({
            success: true,
            message:
                `User '${username}' created successfully`,
            data: result.user
        });


    } catch (error) {

        console.error(
            "Create user error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to create user"
        });
    }
}


async function changeUserLockState(
    req,
    res
) {

    try {

        const { username } = req.params;
        const { action } = req;


        if (
            !/^[a-z_][a-z0-9_-]{0,31}$/.test(username)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid username"
            });
        }


        const result =
            await userService
                .changeUserLockState(
                    username,
                    action
                );


        if (!result.success) {

            if (result.type === "not-found") {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (result.type === "protected") {

                return res.status(403).json({
                    success: false,
                    message: result.message
                });
            }


            return res.status(500).json({
                success: false,
                message: result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `User '${username}' ${action}ed successfully`
        });


    } catch (error) {

        console.error(
            "User account action error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to modify user account"
        });
    }
}


async function deleteUser(req, res) {

    try {

        const { username } = req.params;

        const {
            removeHome = false,
            confirmation
        } = req.body || {};


        if (
            !/^[a-z_][a-z0-9_-]{0,31}$/.test(username)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid username"
            });
        }


        if (typeof removeHome !== "boolean") {

            return res.status(400).json({
                success: false,
                message:
                    "removeHome must be true or false"
            });
        }


        // Explicit confirmation required
        const expectedConfirmation =
            removeHome
                ? `DELETE ${username} AND HOME`
                : `DELETE ${username}`;


        if (confirmation !== expectedConfirmation) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid deletion confirmation",
                requiredConfirmation:
                    expectedConfirmation
            });
        }


        const result =
            await userService.deleteUser(
                username,
                removeHome
            );


        if (!result.success) {

            if (result.type === "not-found") {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (
                result.type === "protected" ||
                result.type === "logged-in"
            ) {

                return res.status(403).json({
                    success: false,
                    message: result.message
                });
            }


            return res.status(500).json({
                success: false,
                message: result.message
            });
        }


        return res.status(200).json({
            success: true,
            message:
                `User '${username}' deleted successfully`,
            data: {
                username:
                    result.username,
                homeDirectory:
                    result.homeDirectory,
                homeRemoved:
                    result.homeRemoved
            }
        });


    } catch (error) {

        console.error(
            "Delete user error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to delete user"
        });
    }
}

module.exports = {
    getUsers,
    getUserByUsername,
     createUser,
    changeUserLockState,
    deleteUser

};