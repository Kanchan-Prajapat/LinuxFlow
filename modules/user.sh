#!/bin/bash

############################################
# User Management Module
############################################


##################################################
# Function : validate_existing_user
# Purpose  : Validates an existing Linux user
##################################################

validate_username() {

    local username="$1"

    if [[ ! "$username" =~ ^[a-z_][a-z0-9_-]{2,31}$ ]]; then
        return 1
    fi

    return 0
}

##################################################
# Function : user_exists
# Purpose  : Checks whether a Linux user exists
##################################################

user_exists() {

    local username="$1"

    id "$username" &>/dev/null

}


##################################################
# Function : validate_existing_user
# Purpose  : Validates an existing Linux user
##################################################


validate_existing_user() {

    local username="$1"

    # Empty Check
    if [ -z "$username" ]; then
        error "Username cannot be empty."
        return 1
    fi

    # User Exists?
    if ! user_exists "$username"; then
        error "User '$username' does not exist."
        return 1
    fi

    return 0
}


##################################################
# Function : validate_new_user
# Purpose  : Validates a new Linux user
##################################################

validate_new_user() {

    local username="$1"

    # Empty Check
    if [ -z "$username" ]; then
        error "Username cannot be empty."
        return 1
    fi

    # Username Format
    if ! validate_username "$username"; then
        error "Invalid username."
        return 1
    fi

    # User Already Exists
    if user_exists "$username"; then
        error "User '$username' already exists."
        return 1
    fi

    return 0
}

##################################################
# Function : protect_system_user
# Purpose  : Prevent dangerous operations on
#            root and system accounts
##################################################

protect_system_user() {

    local username="$1"
    local uid
    local uid_min

    uid=$(id -u "$username" 2>/dev/null)

    if [ -z "$uid" ]; then
        error "Unable to determine UID for '$username'."
        return 1
    fi

    # Never allow destructive operations on root
    if [ "$uid" -eq 0 ]; then
        error "Operation cannot be performed on the root user."
        return 1
    fi

    # Read normal-user UID threshold from login.defs
    uid_min=$(awk '/^[[:space:]]*UID_MIN[[:space:]]+/ {print $2; exit}' /etc/login.defs)

    # Fallback for normal RHEL configuration
    uid_min=${uid_min:-1000}

    if [ "$uid" -lt "$uid_min" ]; then
        error "Operation blocked for system account '$username'."
        return 1
    fi

    return 0
}




##################################################
# Function : create_user
# Purpose  : Creates a new Linux user account
##################################################


create_user() {

    header

    echo "========== Create User =========="
    echo

    read -p "Enter Username: " username

if ! validate_new_user "$username"; then
    pause
    return
fi

    # Create user with home directory
if useradd -m "$username"; then
    success "User '$username' created successfully."
else
    error "Failed to create user."
fi
    pause
}



##################################################
# Function : delete_user
# Purpose  : Safely delete an existing Linux user
##################################################

delete_user() {

    header

    echo "========== Delete User =========="
    echo

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    if ! protect_system_user "$username"; then
        pause
        return
    fi

    ##################################################
    # Check active login sessions
    ##################################################

    if who | awk '{print $1}' | grep -Fxq "$username"; then
        error "User '$username' is currently logged in."
        warning "Log out the user before deleting the account."
        pause
        return
    fi

    ##################################################
    # Check running processes
    ##################################################

    if pgrep -u "$username" &>/dev/null; then
        error "User '$username' currently has running processes."
        warning "Stop the user's processes before deleting the account."
        pause
        return
    fi

    home_dir=$(getent passwd "$username" | cut -d: -f6)

    echo
    echo "Username       : $username"
    echo "Home Directory : $home_dir"
    echo

    warning "The user account and its home directory will be permanently deleted."
    echo

    read -p "Delete '$username' permanently? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if userdel -r "$username"; then
                success "User '$username' deleted successfully."
            else
                error "Failed to delete user."
            fi
            ;;

        N|n)

            warning "Operation cancelled."
            ;;

        *)

            error "Invalid choice."
            ;;

    esac

    pause
}




##################################################
# Function : lock_user
# Purpose  : Lock a Linux user account
##################################################

lock_user() {

    header

    echo "========== Lock User =========="
    echo

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    if ! protect_system_user "$username"; then
        pause
        return
    fi

    password_status=$(passwd -S "$username" 2>/dev/null | awk '{print $2}')

    if [ "$password_status" = "L" ] ||
       [ "$password_status" = "LK" ]; then

        warning "User '$username' is already locked."
        pause
        return
    fi

    echo
    read -p "Lock '$username'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if passwd -l "$username"; then
                success "User '$username' locked successfully."
            else
                error "Failed to lock user."
            fi
            ;;

        N|n)

            warning "Operation cancelled."
            ;;

        *)

            error "Invalid choice."
            ;;

    esac

    pause
}



##################################################
# Function : unlock_user
# Purpose  : Unlock a Linux user account
##################################################

unlock_user() {

    header

    echo "========== Unlock User =========="
    echo

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    if ! protect_system_user "$username"; then
        pause
        return
    fi

    password_status=$(passwd -S "$username" 2>/dev/null | awk '{print $2}')

    if [ "$password_status" != "L" ] &&
       [ "$password_status" != "LK" ]; then

        warning "User '$username' is not locked."
        pause
        return
    fi

    echo
    read -p "Unlock user '$username'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if passwd -u "$username"; then
                success "User '$username' unlocked successfully."
            else
                error "Failed to unlock user."
                warning "The account may not have a valid password."
            fi
            ;;

        N|n)

            warning "Operation cancelled."
            ;;

        *)

            error "Invalid choice."
            ;;

    esac

    pause
}




##################################################
# Function : reset_password
# Purpose  : reset the password of a Linux user account
##################################################

reset_password() {
    header
    echo "========== Reset Password =========="
    echo

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    if ! protect_system_user "$username"; then
    pause
    return
fi


       echo
        read -p "Reset password for user '$username'? (Y/N): " confirm

 case "$confirm" in

    Y|y)

        if passwd "$username"; then
            success "Password reset successfully for user '$username'."
        else
            error "Failed to reset password for user '$username'."
        fi
        ;;

    N|n)

        warning "Operation cancelled."
        ;;

    *)

        error "Invalid choice."
        ;;

esac

    pause
}

##################################################
# Function : user_information
# Purpose  : Displays information about a Linux user
##################################################

user_information() {

    header

    echo "========== User Information =========="
    echo

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    echo

    # Get user information
    user_info=$(getent passwd "$username")

    IFS=':' read -r user pass uid gid comment home shell <<< "$user_info"

    status=$(passwd -S "$username")
    password_status=$(echo "$status" | awk '{print $2}')

   case "$password_status" in

    L|LK)
        account_status="Locked"
        ;;

    P|PS)
        account_status="Password Set / Unlocked"
        ;;

    NP)
        account_status="No Password"
        ;;

    *)
        account_status="Unknown"
        ;;

esac

    echo "========================================"
    echo "         User Information"
    echo "========================================"

    echo "Username        : $user"
    echo "UID             : $uid"
    echo "GID             : $gid"

    echo "Groups          : $(id -nG "$username")"

    echo "Home Directory  : $home"

    echo "Login Shell     : $shell"

    echo "Account Status  : $account_status"

    echo
    echo "Password Aging"
    echo "----------------------------------------"

    chage -l "$username"

    echo "========================================"

    pause
}


##################################################
# Function : list_users
# Purpose  : Displays all normal Linux users
##################################################

list_users() {

    header

    echo "========== User List =========="
    echo

    uid_min=$(awk '/^[[:space:]]*UID_MIN[[:space:]]+/ {print $2; exit}' /etc/login.defs)
    uid_min=${uid_min:-1000}

    printf "%-20s %-10s %-25s\n" \
        "USERNAME" "UID" "SHELL"

    printf "%-20s %-10s %-25s\n" \
        "--------------------" \
        "----------" \
        "-------------------------"

    awk -F: -v min="$uid_min" \
    '$3 >= min && $3 < 65534 {
        printf "%-20s %-10s %-25s\n", $1, $3, $7
    }' /etc/passwd

    total=$(awk -F: -v min="$uid_min" \
    '$3 >= min && $3 < 65534 {count++}
     END {print count+0}' /etc/passwd)

    echo
    echo "-------------------------------------------------------"
    echo "Total Users : $total"

    pause
}





##################################################
# Function : user_menu
# Purpose  : Displays User Management Menu
##################################################

user_menu() {

while true
do

header

echo "========== User Management =========="
echo
echo "1. Create User"
echo "2. Delete User"
echo "3. Lock User"
echo "4. Unlock User"
echo "5. Reset Password"
echo "6. User Information"
echo "7. List Users"
echo
echo "0. Back"

echo

read -p "Choose Option : " choice

case $choice in

1)
create_user
;;

2)
delete_user
;;

3)
lock_user
;;

4)
unlock_user
;;

5)
reset_password
;;

6)
user_information
;;

7)
list_users
;;

0)
break
;;

*)
error "Invalid Option"
pause
;;

esac

done

}