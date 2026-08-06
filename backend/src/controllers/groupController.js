const groupService =
    require("../services/groupService");

    function isValidGroupName(groupName) {
    return /^[a-z_][a-z0-9_-]{0,31}$/.test(groupName);
}

function isValidUsername(username) {
    return /^[a-z_][a-z0-9_-]{0,31}$/.test(username);
}


async function getGroups(req, res) {

    try {

        let groups =
            await groupService.getGroups();

        const {
            search,
            limit
        } = req.query;


        // Search by group name or GID
        if (search) {

            const term =
                String(search).toLowerCase();

            groups = groups.filter(group =>

                group.groupName
                    .toLowerCase()
                    .includes(term) ||

                String(group.gid) === term
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

            groups =
                groups.slice(0, parsedLimit);
        }


        return res.status(200).json({
            success: true,
            count: groups.length,

            filters: {
                search: search || null,
                limit:
                    limit !== undefined
                        ? Number(limit)
                        : null
            },

            data: groups
        });


    } catch (error) {

        console.error(
            "Group list error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve groups"
        });
    }
}


async function getGroupByName(req, res) {

    try {

        const { groupName } = req.params;


        if (
            !/^[a-z_][a-z0-9_-]{0,31}$/.test(groupName)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid group name"
            });
        }


        const group =
            await groupService
                .getGroupByName(groupName);


        if (!group) {

            return res.status(404).json({
                success: false,
                message:
                    `Group '${groupName}' not found`
            });
        }


        return res.status(200).json({
            success: true,
            data: group
        });


    } catch (error) {

        console.error(
            "Group information error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve group information"
        });
    }
}


async function createGroup(req, res) {

    try {

        const { groupName } = req.body;

        if (
            typeof groupName !== "string" ||
            !isValidGroupName(groupName)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid group name"
            });
        }


        const result =
            await groupService.createGroup(groupName);


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
                `Group '${groupName}' created successfully`,
            data: result.group
        });

    } catch (error) {

        console.error("Create group error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create group"
        });
    }
}


async function addGroupMember(req, res) {

    try {

        const { groupName } = req.params;
        const { username } = req.body;


        if (
            !isValidGroupName(groupName) ||
            typeof username !== "string" ||
            !isValidUsername(username)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid group name or username"
            });
        }


        const result =
            await groupService.addGroupMember(
                groupName,
                username
            );


        if (!result.success) {

            if (
                result.type === "group-not-found" ||
                result.type === "user-not-found"
            ) {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (result.type === "already-member") {

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


        return res.status(200).json({
            success: true,
            message:
                `User '${username}' added to group '${groupName}'`,
            data: result.group
        });

    } catch (error) {

        console.error(
            "Add group member error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to add group member"
        });
    }
}


async function removeGroupMember(req, res) {

    try {

        const {
            groupName,
            username
        } = req.params;


        if (
            !isValidGroupName(groupName) ||
            !isValidUsername(username)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid group name or username"
            });
        }


        const result =
            await groupService.removeGroupMember(
                groupName,
                username
            );


        if (!result.success) {

            if (
                result.type === "group-not-found" ||
                result.type === "user-not-found"
            ) {

                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }


            if (result.type === "not-member") {

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


        return res.status(200).json({
            success: true,
            message:
                `User '${username}' removed from group '${groupName}'`,
            data: result.group
        });

    } catch (error) {

        console.error(
            "Remove group member error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to remove group member"
        });
    }
}


async function deleteGroup(req, res) {

    try {

        const { groupName } = req.params;
        const { confirmation } = req.body || {};


        if (!isValidGroupName(groupName)) {

            return res.status(400).json({
                success: false,
                message: "Invalid group name"
            });
        }


        const requiredConfirmation =
            `DELETE ${groupName}`;


        if (confirmation !== requiredConfirmation) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid deletion confirmation",
                requiredConfirmation
            });
        }


        const result =
            await groupService.deleteGroup(
                groupName
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
                `Group '${groupName}' deleted successfully`
        });

    } catch (error) {

        console.error(
            "Delete group error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to delete group"
        });
    }
}

module.exports = {
    getGroups,
    getGroupByName,
    createGroup,
    addGroupMember,
    removeGroupMember,
    deleteGroup
};