const fs = require("fs");

const FSTAB_PATH = "/etc/fstab";
const BACKUP_PATH = "/etc/fstab.linuxflow.bak";


// ########################################################
// Backup /etc/fstab
// ########################################################

async function backupFstab() {

    if (!fs.existsSync(BACKUP_PATH)) {

        await fs.promises.copyFile(
            FSTAB_PATH,
            BACKUP_PATH
        );
    }
}


// ########################################################
// Read /etc/fstab
// ########################################################

async function readFstab() {

    return await fs.promises.readFile(
        FSTAB_PATH,
        "utf8"
    );
}


// ########################################################
// Find entry
// ########################################################

async function findFstabEntry(identifier) {

    const content =
        await readFstab();

    const lines =
        content.split("\n");


    return lines.find(line => {

        const trimmed =
            line.trim();

        if (
            !trimmed ||
            trimmed.startsWith("#")
        ) {
            return false;
        }

        const parts =
            trimmed.split(/\s+/);

        return (
            parts[0] === identifier ||
            parts[1] === identifier
        );
    }) || null;
}


// ########################################################
// Add entry
// ########################################################

async function addFstabEntry({
    source,
    target,
    filesystem,
    options = "defaults",
    dump = 0,
    pass = 0
}) {

    await backupFstab();


    const existingSource =
        await findFstabEntry(source);

    if (existingSource) {

        return {
            success: false,
            type: "exists",
            message:
                `FSTAB entry already exists for '${source}'`
        };
    }


    const existingTarget =
        await findFstabEntry(target);

    if (existingTarget) {

        return {
            success: false,
            type: "target-exists",
            message:
                `FSTAB entry already exists for mount point '${target}'`
        };
    }


    const entry =
        `${source}\t${target}\t${filesystem}\t${options}\t${dump}\t${pass}`;


    await fs.promises.appendFile(
        FSTAB_PATH,
        `\n${entry}\n`
    );


    return {
        success: true,
        entry
    };
}


// ########################################################
// Remove entry
// ########################################################

async function removeFstabEntry(identifier) {

    await backupFstab();


    const content =
        await readFstab();


    const lines =
        content.split("\n");


    let removed = false;


    const updated =
        lines.filter(line => {

            const trimmed =
                line.trim();


            if (
                !trimmed ||
                trimmed.startsWith("#")
            ) {
                return true;
            }


            const parts =
                trimmed.split(/\s+/);


            if (
                parts[0] === identifier ||
                parts[1] === identifier
            ) {

                removed = true;
                return false;
            }


            return true;
        });


    if (!removed) {

        return {
            success: false,
            type: "not-found",
            message:
                `No FSTAB entry found for '${identifier}'`
        };
    }


    await fs.promises.writeFile(
        FSTAB_PATH,
        updated.join("\n"),
        "utf8"
    );


    return {
        success: true
    };
}


module.exports = {
    backupFstab,
    readFstab,
    findFstabEntry,
    addFstabEntry,
    removeFstabEntry
};