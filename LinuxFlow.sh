#!/bin/bash

############################################
# LinuxFlow
############################################

# Load Common Library
source ./modules/common.sh
source ./modules/user.sh
source ./modules/group.sh
source ./utils/logger.sh
source ./modules/backup.sh
source ./modules/permission.sh
source ./modules/process.sh
source ./modules/service.sh
source ./modules/firewall.sh
source ./modules/acl.sh
source ./modules/lvm.sh
source ./modules/swap.sh
source ./modules/ssh.sh
source ./modules/cron.sh
source ./modules/monitoring.sh
source modules/reports.sh
############################################
# Application Started
############################################

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