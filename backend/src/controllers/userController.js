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


module.exports = {
    getUsers,
    getUserByUsername
};