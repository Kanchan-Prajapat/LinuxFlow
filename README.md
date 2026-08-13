# LinuxFlow

> **Automate • Monitor • Manage**

![Bash](https://img.shields.io/badge/Shell-Bash-4EAA25?logo=gnubash&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Linux-blue)
![RHEL](https://img.shields.io/badge/Tested%20On-RHEL-red)
![Version](https://img.shields.io/badge/Version-0.1.0-orange)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

**LinuxFlow** is a modular Linux server administration, automation,
monitoring, and management suite designed to simplify common system
administration tasks through a centralized command-line interface and
REST API backend.

It combines user administration, group management, permissions, ACLs,
storage management, security, monitoring, automation, backup, SSH
management, and reporting into a single integrated platform.

LinuxFlow provides two complementary interfaces:

- **LinuxFlow CLI** — Interactive Bash-based administration interface
- **LinuxFlow API** — Node.js/Express REST API for programmatic system
  management and integration

LinuxFlow focuses not only on automation but also on **safe system
administration** by incorporating input validation, confirmation prompts,
configuration backups, rollback mechanisms, critical resource protection,
and activity logging.

---

## Architecture

LinuxFlow follows a modular architecture where administrative operations
are separated into independent layers.

```text
                        LinuxFlow
                            |
              +-------------+-------------+
              |                           |
          CLI Layer                   API Layer
         Bash Scripts             Node.js / Express
              |                           |
           Modules                     Routes
              |                           |
              |                      Controllers
              |                           |
              |                       Services
              |                           |
              +-------------+-------------+
                            |
                       Linux System
                            |
              systemd / firewalld / SSH
              ACL / LVM / Swap / Cron
              Users / Groups / Processes

```

## Features

LinuxFlow currently provides **14 integrated management modules**:

| # | Module | Description |
|---|---|---|
| 1 | User Management | Create, delete, lock, unlock, and manage Linux users |
| 2 | Group Management | Create, delete, and manage Linux groups and memberships |
| 3 | Permission Manager | View and modify file permissions, ownership, and groups |
| 4 | Backup Manager | Create, list, restore, and delete compressed backups |
| 5 | Process Manager | View, search, inspect, and safely terminate processes |
| 6 | Service Manager | Manage and inspect systemd services |
| 7 | Firewall Manager | Manage firewalld ports and predefined services |
| 8 | ACL Manager | View and manage user/group Access Control Lists |
| 9 | LVM Manager | Manage physical volumes, volume groups, logical volumes, and filesystems |
| 10 | Swap Manager | Create, enable, disable, inspect, and persist swap |
| 11 | SSH Manager | Inspect and securely manage OpenSSH server configuration |
| 12 | Cron Manager | Create, inspect, remove, back up, and restore cron jobs |
| 13 | Monitoring Dashboard | Monitor CPU, memory, disks, load, network, I/O, users, and system health |
| 14 | Report Generator | Generate structured system administration reports |

---

## Safety Features

LinuxFlow performs potentially sensitive administrative operations with
multiple safety controls.

### Input Validation

User input is validated before system commands are executed, including:

- Process IDs
- User and group names
- File and directory paths
- Port numbers
- Firewall protocols and services
- LVM names and sizes
- Swap sizes
- Cron schedule fields
- SSH configuration values

### Critical Resource Protection

LinuxFlow includes protection against accidental modification or
termination of important system resources.

Examples include:

- PID 1 protection
- LinuxFlow process protection
- Parent process protection
- Critical service/process protection
- Critical filesystem path protection
- Symbolic-link protection for sensitive permission operations
- Mounted-device checks before LVM initialization
- Existing storage-signature detection
- SSH access protection during firewall changes

### Confirmation Prompts

Potentially destructive operations require explicit confirmation before
execution.

More sensitive operations may require the user to type:

```text
YES
```

instead of accepting a simple `Y/N` confirmation.

### Configuration Backups

Before modifying important configuration files, LinuxFlow creates backup
copies where appropriate.

Examples include:

```text
/etc/fstab
/etc/ssh/sshd_config
```

### Rollback Mechanisms

LinuxFlow attempts to restore the previous configuration when critical
operations fail.

Rollback support is implemented in areas such as:

- SSH configuration changes
- SSH firewall changes
- SSH SELinux port configuration
- Firewall rule modifications
- Persistent swap configuration
- Persistent LVM filesystem configuration
- Cron modifications and restoration

---

## Project Structure

---

```text
LinuxFlow/
│
├── LinuxFlow.sh
├── install.sh
├── uninstall.sh
├── README.md
├── LICENSE
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── app.js
│       ├── controllers/
│       ├── routes/
│       └── services/
│
├── config/
│   └── linuxflow.conf
│
├── modules/
│   ├── common.sh
│   ├── user.sh
│   ├── group.sh
│   ├── permission.sh
│   ├── backup.sh
│   ├── process.sh
│   ├── service.sh
│   ├── firewall.sh
│   ├── acl.sh
│   ├── lvm.sh
│   ├── swap.sh
│   ├── ssh.sh
│   ├── cron.sh
│   ├── monitoring.sh
│   └── reports.sh
│
├── utils/
│   └── logger.sh
│
├── logs/
│   └── activity.log
│
├── backups/
│
└── reports/
```

---



---


### Running the Backend

Enter the backend directory:

```bash
cd backend
```

Install backend dependencies:

```bash
npm install
```

Start the LinuxFlow API:

```bash
npm start
```

The API runs by default on:

```text
http://localhost:5000
```

Example API request:

```bash
curl http://localhost:5000/api/system/info
```

For development with automatic restart:

```bash
npm run dev
```


### Backend Stack

- Node.js
- Express.js
- CORS
- dotenv
- Nodemon for development

### Backend Directory

```text
backend/
├── package.json
├── package-lock.json
└── src/
    ├── app.js
    ├── routes/
    ├── controllers/
    └── services/
```



## Requirements

LinuxFlow is designed for Linux systems and has been developed and tested
primarily in a **RHEL-based environment**.

### Core Requirements

- Bash
- systemd
- Standard GNU/Linux utilities
- Root or appropriate administrative privileges

### Feature-Specific Utilities

Some modules depend on additional system packages or utilities:

```text
firewalld
openssh-server
lvm2
acl
cronie
sysstat
policycoreutils-python-utils
```

Depending on the Linux installation, some of these packages may already
be installed.

On a RHEL-based system, packages can be installed using `dnf`, for
example:

```bash
dnf install firewalld openssh-server lvm2 acl cronie sysstat
```

For SSH port management on SELinux-enforcing systems:

```bash
dnf install policycoreutils-python-utils
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/Kanchan-Prajapat/LinuxFlow.git
```

Enter the project directory:

```bash
cd LinuxFlow
```

Make the installer executable:

```bash
chmod +x install.sh
```

Run the installer with administrative privileges:

```bash
sudo ./install.sh
```

The installer automatically:

- Detects the supported Linux distribution
- Validates LinuxFlow source files
- Validates Bash script syntax
- Checks required system dependencies
- Installs missing dependencies when approved
- Installs LinuxFlow under `/opt/linuxflow`
- Creates the global `linuxflow` command
- Validates the completed installation

After installation, start LinuxFlow using:

```bash
sudo linuxflow
```

### Uninstallation

To remove LinuxFlow:

```bash
sudo ./uninstall.sh
```

The uninstaller provides options to preserve or permanently delete
LinuxFlow runtime data such as logs, backups, and reports.
---


## Screenshots

### LinuxFlow CLI

The LinuxFlow interactive command-line interface provides access to all
14 system administration modules from a centralized menu.

![LinuxFlow CLI](docs/screenshots/linuxflow-menu.png)

### LinuxFlow API

The REST API provides programmatic access to LinuxFlow system-management
functionality.

![LinuxFlow API](docs/screenshots/linuxflow-api.png)

### Installation

LinuxFlow provides an automated installation process with dependency,
source, and syntax validation.

![LinuxFlow Installation](docs/screenshots/linuxflow-install.png)

### Uninstallation

The uninstaller validates complete removal of the LinuxFlow installation
and global command.

![LinuxFlow Uninstallation](docs/screenshots/linuxflow-uninstall.png)



## Main Menu

LinuxFlow provides a centralized interactive menu:

```text
===============================================================
                         LinuxFlow
                   Automate • Monitor • Manage
===============================================================

1. User Management
2. Group Management
3. Permission Manager
4. Backup Manager
5. Process Manager
6. Service Manager
7. Firewall Manager
8. ACL Manager
9. LVM Manager
10. Swap Manager
11. SSH Manager
12. Cron Manager
13. Monitoring Dashboard
14. Report Generator

0. Exit
```

---

## Module Overview

### User Management

Provides common Linux user administration operations such as user
creation, deletion, account locking, unlocking, and password management.

### Group Management

Provides Linux group administration and membership management with
validation for existing users and groups.

### Permission Manager

Allows administrators to inspect and modify:

- Numeric file permissions
- File ownership
- File group ownership

The module includes path validation and protection for sensitive targets.

### Backup Manager

Provides compressed archive management including:

- Backup creation
- Backup listing
- Backup restoration
- Backup deletion
- Archive validation

Backup names are generated automatically and operations include safety
checks before restoration or deletion.

### Process Manager

Provides:

- Running process listing
- Exact process-name search
- Detailed process information
- System resource information
- Safe process termination

LinuxFlow first sends `SIGTERM` and only offers `SIGKILL` when the
process fails to terminate normally.

Critical system processes are protected from accidental termination.

### Service Manager

Provides management of systemd services including:

- Service status
- Start
- Stop
- Restart
- Enable
- Disable

Critical services receive additional protection before potentially
disruptive operations.

### Firewall Manager

Provides firewalld administration including:

- Firewall status
- Rule listing
- Allow port
- Remove port
- Allow predefined service
- Remove predefined service
- Firewall reload

Firewall modifications include duplicate detection, validation,
confirmation, SSH access protection, and rollback handling.

### ACL Manager

Provides Access Control List management using `getfacl` and `setfacl`.

Supported operations include:

- View ACL
- Add user ACL
- Add group ACL
- Remove user ACL
- Remove group ACL
- Remove extended ACL entries

ACL operations reuse LinuxFlow's user, group, path, and critical-resource
validation mechanisms.

### LVM Manager

Provides management and inspection of:

- Physical Volumes
- Volume Groups
- Logical Volumes
- Filesystems
- Persistent mounts

Safety checks include mounted-device detection and existing storage
signature protection before initializing physical volumes.

Persistent filesystem configuration uses UUID-based `/etc/fstab`
entries where appropriate.

### Swap Manager

Provides:

- Swap status
- Active swap listing
- Swap-file creation
- Swap enabling
- Swap disabling
- Persistent swap configuration
- Swap information
- Swap-file removal

Swap devices can use UUID-based persistent configuration, while swap
files use their absolute filesystem paths.

Memory availability is checked before disabling active swap.

### SSH Manager

Provides OpenSSH server administration including:

- SSH service status
- Effective configuration inspection
- Active SSH connections
- SSH port management
- Root-login management
- Password authentication management
- Public-key authentication management
- Configuration backup and restoration
- SSH security checks

SSH port changes integrate with firewalld and SELinux when applicable.

If a later stage of a port change fails, LinuxFlow attempts to roll back
the SSH configuration and any firewall or SELinux changes introduced by
the operation.

### Cron Manager

Provides cron administration including:

- Cron service status
- Current-user cron jobs
- Other-user cron jobs
- Cron job creation
- Cron job removal
- Crontab backup
- Crontab restoration
- Cron health checks

Temporary files and backup copies are used to make crontab modification
safer.

### Monitoring Dashboard

Provides system monitoring for:

- CPU usage
- Memory usage
- Swap usage
- Disk usage
- System load
- Top CPU-consuming processes
- Top memory-consuming processes
- Network statistics
- Disk I/O statistics
- System uptime
- Logged-in users
- Recent failed login attempts
- Overall system health

Threshold-based status messages help identify warning and critical
conditions.

### Report Generator

Generates administrative reports for:

- System information
- Users and groups
- Storage
- Services
- Security
- Full system overview

Generated reports can also be viewed and deleted directly through
LinuxFlow.

---

## Logging

LinuxFlow records application activity through its logging system.

Default log location:

```text
logs/activity.log
```

Example log format:

```text
05-08-2026 23:36:51 | USER=root | HOST=server.example.com | LinuxFlow Started
05-08-2026 23:37:00 | USER=root | HOST=server.example.com | LinuxFlow Closed
```

Logging behavior can be controlled through:

```text
config/linuxflow.conf
```

---

## Configuration

LinuxFlow uses a centralized configuration file:

```text
config/linuxflow.conf
```

Example configuration:

```bash
APP_NAME="LinuxFlow"
VERSION="0.1.0"
AUTHOR="Kanchan Prajapat"

LOG_FILE="./logs/activity.log"
BACKUP_DIR="./backups"
REPORT_DIR="./reports"

DATE_FORMAT="%d-%m-%Y %H:%M:%S"

DEFAULT_EDITOR="vi"

ENABLE_LOGGING=true
THEME=dark
```

---

## Validation and Testing

---

### Installation Testing

The LinuxFlow installation lifecycle has been tested on a RHEL-based
virtual machine.

Validation includes:

- Fresh installation using `install.sh`
- Global `linuxflow` command verification
- CLI startup verification
- Complete uninstallation using `uninstall.sh`
- Installation cleanup validation
- Runtime data handling during uninstallation
- Fresh reinstallation after uninstallation

### Backend Validation

The LinuxFlow API backend has also been validated through multiple levels
of testing.

Validation includes:

- JavaScript syntax validation
- Backend module loading
- Route-to-controller audit
- Controller-to-service audit
- Service export validation
- API startup validation
- REST endpoint smoke testing
- Functional testing of administrative modules
- Dependency security audit

The latest backend dependency audit reported:

```text
0 vulnerabilities
```

This result reflects the dependency state at the time of the latest
validation.

### Bash Syntax Validation

All shell scripts can be validated using:

```bash
find . -type f -name "*.sh" -print0 |
while IFS= read -r -d '' file
do
    if bash -n "$file"; then
        echo "[PASS] $file"
    else
        echo "[FAIL] $file"
    fi
done
```

The current project modules pass Bash syntax validation.

### Module Loading

LinuxFlow modules have been tested for successful sourcing and dependency
loading.

### Integration Testing

All 14 module menu entry functions have been verified as available after
module loading.

### Runtime Smoke Testing

The interactive application has been tested for:

- Main menu startup
- All 14 module menus
- Module-to-main-menu navigation
- Clean application exit
- Activity logging

Individual administrative features should always be tested in a safe
development or virtual-machine environment before use on production
systems.

---

## Security Considerations

LinuxFlow performs privileged system administration operations.

It is strongly recommended to:

- Review commands before confirming destructive actions.
- Keep an active SSH session open when modifying SSH configuration.
- Test a new SSH port from another terminal before closing the current
  connection.
- Verify firewall rules before removing existing SSH access.
- Maintain external backups of important configuration and data.
- Carefully verify block-device names before performing LVM operations.
- Test LinuxFlow in a virtual machine before using it on production
  infrastructure.

LinuxFlow's validation and rollback mechanisms reduce operational risk,
but they are not a replacement for proper system backups and
administrative review.

---

## Version

Current development version:

```text
0.1.0
```

---

## Roadmap

Possible future improvements include:

- Additional Linux distribution support
- Improved configuration portability
- More detailed system-health analysis
- Exportable monitoring summaries
- Additional security auditing
- Automated dependency checking
- Command-line/non-interactive execution mode

---

## Author

**Kanchan Prajapat**

B.Tech Computer Science Engineering

LinuxFlow was developed as a Linux system administration, automation,
monitoring, and management project with a focus on practical
server-management workflows.

---

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for details.

---

## Disclaimer

LinuxFlow can modify important operating-system configuration, storage,
network, security, and service settings.

Use it carefully and preferably test changes in a virtual machine or
non-production environment first.

The author is not responsible for data loss, service interruption, or
system misconfiguration caused by improper use.
