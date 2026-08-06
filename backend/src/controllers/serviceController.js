const serviceService =
    require("../services/serviceService");


async function getServices(req, res) {

    try {

        let services =
            await serviceService.getServices();

        const {
            search,
            state,
            limit
        } = req.query;


        // Search
        if (search) {

            const term =
                String(search).toLowerCase();

            services = services.filter(service =>

                service.name
                    .toLowerCase()
                    .includes(term) ||

                service.description
                    .toLowerCase()
                    .includes(term)
            );
        }


        // Filter by active state
        if (state) {

            const validStates = [
                "active",
                "inactive",
                "failed",
                "activating",
                "deactivating"
            ];

            if (!validStates.includes(state)) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid service state"
                });
            }

            services = services.filter(
                service =>
                    service.active === state
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

            services =
                services.slice(0, parsedLimit);
        }


        return res.status(200).json({
            success: true,
            count: services.length,

            filters: {
                search: search || null,
                state: state || null,
                limit: limit
                    ? Number(limit)
                    : null
            },

            data: services
        });

    } catch (error) {

        console.error(
            "Service list error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve services"
        });
    }
}


async function getServiceByName(req, res) {

    try {

        const { name } = req.params;


        // Basic service-name validation
        if (
            !/^[a-zA-Z0-9@_.:-]+$/.test(name)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid service name"
            });
        }


        const service =
            await serviceService
                .getServiceByName(name);


        if (!service) {

            return res.status(404).json({
                success: false,
                message:
                    `Service '${name}' not found`
            });
        }


        return res.status(200).json({
            success: true,
            data: service
        });

    } catch (error) {

        console.error(
            "Service information error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve service information"
        });
    }
}


module.exports = {
    getServices,
    getServiceByName
};