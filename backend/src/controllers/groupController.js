const groupService =
    require("../services/groupService");


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


module.exports = {
    getGroups,
    getGroupByName
};