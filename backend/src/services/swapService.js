const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const {
    addFstabEntry,
    removeFstabEntry,
    findFstabEntry
} = require("../utils/fstab");

const execFileAsync = promisify(execFile);


async function runCommand(command, args = []) {

    const { stdout } =
        await execFileAsync(
            command,
            args,
            {
                timeout: 30000,
                maxBuffer: 5 * 1024 * 1024
            }
        );

    return stdout.trim();
}


function isManagedSwapPath(path) {

    return (
        typeof path === "string" &&
        /^\/swap_linuxflow_[a-zA-Z0-9_-]+$/.test(path)
    );
}


async function getSwapInfo() {

    const stdout =
        await runCommand(
            "swapon",
            [
                "--show",
                "--bytes",
                "--noheadings",
                "--output=NAME,TYPE,SIZE,USED,PRIO"
            ]
        );


    if (!stdout) {
        return [];
    }


    return stdout
        .split("\n")
        .filter(Boolean)
        .map(line => {

            const parts =
                line.trim().split(/\s+/);

            return {
                name: parts[0],
                type: parts[1],
                sizeBytes: Number(parts[2]),
                usedBytes: Number(parts[3]),
                priority: Number(parts[4]),

                managedByLinuxFlow:
                    isManagedSwapPath(parts[0])
            };
        });
}


async function createSwapFile(
    path,
    sizeMB
) {

    if (!isManagedSwapPath(path)) {

        return {
            success: false,
            type: "invalid-path",
            message:
                "Swap file must use /swap_linuxflow_<name>"
        };
    }


    const size =
        Number(sizeMB);


    if (
        !Number.isInteger(size) ||
        size < 64 ||
        size > 4096
    ) {

        return {
            success: false,
            type: "invalid-size",
            message:
                "Swap size must be between 64 MB and 4096 MB"
        };
    }


    if (fs.existsSync(path)) {

        return {
            success: false,
            type: "exists",
            message:
                `File '${path}' already exists`
        };
    }


    const existingFstab =
        await findFstabEntry(path);


    if (existingFstab) {

        return {
            success: false,
            type: "fstab-exists",
            message:
                `An /etc/fstab entry already exists for '${path}'`
        };
    }


    // Create swap file
    await runCommand(
        "fallocate",
        [
            "-l",
            `${size}M`,
            path
        ]
    );


    try {

        await fs.promises.chmod(
            path,
            0o600
        );


        await runCommand(
            "mkswap",
            [path]
        );


        await runCommand(
            "swapon",
            [path]
        );


        // Persist across reboot
        const fstabResult =
            await addFstabEntry({
                source: path,
                target: "none",
                filesystem: "swap",
                options: "sw",
                dump: 0,
                pass: 0
            });


        if (!fstabResult.success) {

            try {
                await runCommand(
                    "swapoff",
                    [path]
                );
            } catch (_) {}


            try {
                await fs.promises.unlink(path);
            } catch (_) {}


            return fstabResult;
        }


        // Final runtime verification
        const swaps =
            await getSwapInfo();


        const created =
            swaps.find(
                item =>
                    item.name === path
            );


        if (!created) {

            // Remove persistence before cleanup
            try {
                await removeFstabEntry(path);
            } catch (_) {}


            throw new Error(
                "SWAP_VALIDATION_FAILED"
            );
        }


        return {
            success: true,

            data: {
                ...created,
                persistent: true
            }
        };


    } catch (error) {

        // Rollback partial state

        try {
            await runCommand(
                "swapoff",
                [path]
            );
        } catch (_) {}


        try {

            const entry =
                await findFstabEntry(path);

            if (entry) {
                await removeFstabEntry(path);
            }

        } catch (_) {}


        try {

            if (fs.existsSync(path)) {
                await fs.promises.unlink(path);
            }

        } catch (_) {}


        throw error;
    }
}



async function removeSwapFile(path) {

    // Protect arbitrary/system swap
    if (!isManagedSwapPath(path)) {

        return {
            success: false,
            type: "protected",
            message:
                "LinuxFlow can only remove swap files using the /swap_linuxflow_<name> convention"
        };
    }


    const fileExists =
        fs.existsSync(path);


    const swaps =
        await getSwapInfo();


    const active =
        swaps.some(
            item =>
                item.name === path
        );


    const fstabEntry =
        await findFstabEntry(path);


    if (
        !fileExists &&
        !active &&
        !fstabEntry
    ) {

        return {
            success: false,
            type: "not-found",
            message:
                `Swap file '${path}' not found`
        };
    }


    /*
     * Disable runtime swap first.
     * Do not delete an active swap file.
     */
    if (active) {

        await runCommand(
            "swapoff",
            [path]
        );
    }


    /*
     * Remove boot persistence.
     */
    let persistentEntryRemoved = false;


    if (fstabEntry) {

        const result =
            await removeFstabEntry(path);


        persistentEntryRemoved =
            result.success;
    }


    /*
     * Delete file only after swapoff
     * and fstab cleanup.
     */
    if (fs.existsSync(path)) {

        await fs.promises.unlink(path);
    }


    return {
        success: true,

        data: {
            path,
            disabled: active,
            persistentEntryRemoved,
            deleted: true
        }
    };
}


module.exports = {
    getSwapInfo,
    createSwapFile,
    removeSwapFile
};


