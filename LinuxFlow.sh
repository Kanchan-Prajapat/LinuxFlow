#!/bin/bash

############################################
# LinuxFlow
############################################

# Load Common Library
source ./modules/common.sh || exit 1
source ./modules/user.sh || exit 1
source ./modules/group.sh || exit 1
source ./utils/logger.sh || exit 1
source ./modules/backup.sh || exit 1
source ./modules/permission.sh || exit 1
source ./modules/process.sh || exit 1
source ./modules/service.sh || exit 1
source ./modules/firewall.sh || exit 1
source ./modules/acl.sh || exit 1
source ./modules/lvm.sh || exit 1
source ./modules/swap.sh || exit 1
source ./modules/ssh.sh || exit 1
source ./modules/cron.sh || exit 1
source ./modules/monitoring.sh || exit 1
source ./modules/reports.sh || exit 1


##################################################
# Function : check_root
# Purpose  : Ensure LinuxFlow runs as root
##################################################

check_root() {

    if [ "$EUID" -ne 0 ]; then

        echo
        error "LinuxFlow requires root privileges."
        echo
        echo "Run LinuxFlow using:"
        echo
        echo "sudo ./linuxflow.sh"
        echo

        exit 1

    fi
}



##################################################
# Function : check_dependencies
# Purpose  : Check required LinuxFlow commands
##################################################

check_dependencies() {

    local missing=0

    local required_commands=(
        awk
        grep
        sed
        find
        stat
        systemctl
        ip
        lsblk
        df
        free
    )

    for command_name in "${required_commands[@]}"
    do

        if ! command -v "$command_name" &>/dev/null; then

            error "Required command '$command_name' is not installed."
            missing=1

        fi

    done

    if [ "$missing" -ne 0 ]; then

        echo
        error "LinuxFlow cannot start because required dependencies are missing."
        exit 1

    fi
}


##################################################
# Function : initialize_directories
# Purpose  : Create required LinuxFlow directories
##################################################

initialize_directories() {

    local directories=(
        "$(dirname "$LOG_FILE")"
        "$BACKUP_DIR"
        "$REPORT_DIR"
    )

    for directory in "${directories[@]}"
    do

        if [ ! -d "$directory" ]; then

            if ! mkdir -p "$directory"; then

                echo
                error "Failed to create directory '$directory'."
                exit 1

            fi

        fi

    done
}



############################################
# Application Started
############################################

check_root
check_dependencies
initialize_directories

log_activity "LinuxFlow Started"

############################################
# Main Menu
############################################

main_menu() {

while true
do

header

echo "1. User Management"
echo "2. Group Management"
echo "3. Permission Manager"
echo "4. Backup Manager"
echo "5. Process Manager"
echo "6. Service Manager"
echo "7. Firewall Manager"
echo "8. ACL Manager"
echo "9. LVM Manager"
echo "10. Swap Manager"
echo "11. SSH Manager"
echo "12. Cron Manager"
echo "13. Monitoring Dashboard"
echo "14. Report Generator"
echo
echo "0. Exit"

echo

read -p "Select Option : " choice

case $choice in

1)

echo
user_menu
;;

2)
echo
group_menu
;;

3)

echo
permission_menu
;;

4)

echo
backup_menu
;;

5)

echo
process_menu
;;

6)

echo
service_menu
;;

7)

echo
firewall_menu
;;

8)

echo
acl_menu
;;

9)

echo
lvm_menu
;;



10)

echo
swap_menu
;;

11)

echo
ssh_menu
;;

12)

echo
cron_menu
;;

13)

echo
monitoring_menu
;;

14)

echo
report_menu
;;

0)

log_activity "LinuxFlow Closed"

clear

exit
;;

*)

error "Invalid Option"

pause
;;

esac

done

}

############################################
# Start Application
############################################

main_menu