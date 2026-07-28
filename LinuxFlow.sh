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
echo "4. ACL Manager"
echo "5. LVM Manager"
echo "6. Swap Manager"
echo "7. Backup Manager"
echo "8. Service Manager"
echo "9. Firewall Manager"
echo "10. SSH Manager"
echo "11. Monitoring Dashboard"
echo "12. Report Generator"
echo
echo "0. Exit"

echo

read -p "Select Option : " choice

case $choice in

1)

echo
user_menu
pause
;;

2)
echo
group_menu
pause
;;

3)

echo
echo "Permission Module Coming Soon"
pause
;;

4)

echo
echo "ACL Module Coming Soon"
pause
;;

5)

echo
echo "LVM Module Coming Soon"
pause
;;

6)

echo
echo "Swap Module Coming Soon"
pause
;;

7)

echo
backup_menu
pause
;;

8)

echo
echo "Service Module Coming Soon"
pause
;;

9)

echo
echo "Firewall Module Coming Soon"
pause
;;

10)

echo
echo "SSH Module Coming Soon"
pause
;;

11)

echo
echo "Monitoring Module Coming Soon"
pause
;;

12)

echo
echo "Reports Module Coming Soon"
pause
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