#!/bin/bash

############################################
# Group Management Module
############################################


##################################################
# Function : validate_group_name
# Purpose  : Validate Linux group name
##################################################

validate_group_name() {

    local groupname="$1"

    if [[ "$groupname" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
        return 0
    else
        return 1
    fi
}

##################################################
# Function : group_exists
# Purpose  : Check whether group exists
##################################################

group_exists() {

    local groupname="$1"

    getent group "$groupname" &>/dev/null
}


##################################################
# Function : validate_existing_group
# Purpose  : Validate existing group
##################################################

validate_existing_group() {

    local groupname="$1"

    if [ -z "$groupname" ]; then
        error "Group name cannot be empty."
        return 1
    fi

    if ! group_exists "$groupname"; then
        error "Group '$groupname' does not exist."
        return 1
    fi

    return 0
}


##################################################
# Function : validate_new_group
# Purpose  : Validate new group
##################################################

validate_new_group() {

    local groupname="$1"

    if [ -z "$groupname" ]; then
        error "Group name cannot be empty."
        return 1
    fi

    if ! validate_group_name "$groupname"; then
        error "Invalid group name."
        return 1
    fi

    if group_exists "$groupname"; then
        error "Group '$groupname' already exists."
        return 1
    fi

    return 0
}


##################################################
# Function : protect_system_group
# Purpose  : Prevent modification of system groups
##################################################

protect_system_group() {

    local groupname="$1"
    local gid
    local gid_min

    gid=$(getent group "$groupname" | cut -d: -f3)

    if [ -z "$gid" ]; then
        error "Unable to determine GID for '$groupname'."
        return 1
    fi

    gid_min=$(awk '/^[[:space:]]*GID_MIN[[:space:]]+/ {
        print $2
        exit
    }' /etc/login.defs)

    gid_min=${gid_min:-1000}

    if [ "$gid" -lt "$gid_min" ]; then
        error "Operation blocked for system group '$groupname'."
        return 1
    fi

    return 0
}   



##################################################
# Function : create_group
# Purpose  : Create a new Linux group
##################################################

create_group() {

    header

    echo "========== Create Group =========="
    echo

    read -p "Enter Group Name: " groupname

    if ! validate_new_group "$groupname"; then
        pause
        return
    fi

    echo
    read -p "Create group '$groupname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if groupadd "$groupname"; then
                success "Group '$groupname' created successfully."
             
            else
                error "Failed to create group '$groupname'."
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
# Function : delete_group
# Purpose  : Safely delete an existing Linux group
##################################################

delete_group() {

    header

    echo "========== Delete Group =========="
    echo

    read -p "Enter Group Name: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    if ! protect_system_group "$groupname"; then
        pause
        return
    fi

    gid=$(getent group "$groupname" | cut -d: -f3)

    ##################################################
    # Check whether group is a primary group
    ##################################################

    primary_users=$(awk -F: -v gid="$gid" \
        '$4 == gid {print $1}' /etc/passwd)

    if [ -n "$primary_users" ]; then

        error "Group '$groupname' is used as a primary group."

        echo
        echo "Primary group of:"
        echo "----------------------------------------"
        echo "$primary_users"

        echo
        warning "Change these users' primary group before deleting it."

        pause
        return
    fi

    echo
    warning "Group '$groupname' will be permanently deleted."
    echo

    read -p "Delete group '$groupname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if groupdel "$groupname"; then
                success "Group '$groupname' deleted successfully."
            else
                error "Failed to delete group '$groupname'."
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
# Function : rename_group
# Purpose  : Safely rename an existing Linux group
##################################################

rename_group() {

    header

    echo "========== Rename Group =========="
    echo

    read -p "Enter Existing Group Name: " old_group

    if ! validate_existing_group "$old_group"; then
        pause
        return
    fi

    if ! protect_system_group "$old_group"; then
        pause
        return
    fi

    echo
    read -p "Enter New Group Name: " new_group

    if ! validate_new_group "$new_group"; then
        pause
        return
    fi

    echo
    read -p "Rename group '$old_group' to '$new_group'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if groupmod -n "$new_group" "$old_group"; then
                success "Group '$old_group' renamed to '$new_group' successfully."
            else
                error "Failed to rename group."
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
# Function : add_user_to_group
# Purpose  : Add user to a Linux group
##################################################

add_user_to_group() {

    header

    echo "========== Add User To Group =========="
    echo

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    echo
    read -p "Enter Group Name: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    ##################################################
    # Check existing membership
    ##################################################

    if id -nG "$username" |
        tr ' ' '\n' |
        grep -Fxq "$groupname"; then

        warning "User '$username' is already a member of '$groupname'."
        pause
        return
    fi

    echo
    read -p "Add user '$username' to group '$groupname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if usermod -aG "$groupname" "$username"; then
                success "User '$username' added to group '$groupname' successfully."
            else
                error "Failed to add user to group."
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
# Function : remove_user_from_group
# Purpose  : Safely remove user from supplementary group
##################################################

remove_user_from_group() {

    header

    echo "========== Remove User From Group =========="
    echo

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    # Protect root/system accounts
    if ! protect_system_user "$username"; then
        pause
        return
    fi

    echo
    read -p "Enter Group Name: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    ##################################################
    # Check user's primary group
    ##################################################

    primary_group=$(id -gn "$username")

    if [ "$primary_group" = "$groupname" ]; then

        error "'$groupname' is the primary group of '$username'."

        warning "Primary groups cannot be removed using this operation."

        pause
        return
    fi

    ##################################################
    # Check supplementary membership
    ##################################################

    members=$(getent group "$groupname" | cut -d: -f4)

    if ! echo "$members" |
        tr ',' '\n' |
        grep -Fxq "$username"; then

        warning "User '$username' is not a supplementary member of '$groupname'."

        pause
        return
    fi

    echo
    read -p "Remove user '$username' from group '$groupname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if gpasswd -d "$username" "$groupname"; then

                success "User '$username' removed from group '$groupname' successfully."

            else

                error "Failed to remove user from group."

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
# Function : group_information
# Purpose  : Display information about Linux group
##################################################

group_information() {

    header

    echo "========== Group Information =========="
    echo

    read -p "Enter Group Name: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    group_info=$(getent group "$groupname")

    IFS=':' read -r group password gid members <<< "$group_info"

    primary_users=$(awk -F: -v gid="$gid" \
        '$4 == gid {print $1}' /etc/passwd |
        paste -sd ',' -)

    echo
    echo "========================================"
    echo "         Group Information"
    echo "========================================"

    echo "Group Name           : $group"
    echo "Group ID (GID)       : $gid"

    if [ -z "$primary_users" ]; then
        echo "Primary Users        : None"
    else
        echo "Primary Users        : $primary_users"
    fi

    if [ -z "$members" ]; then
        echo "Supplementary Users  : None"
    else
        echo "Supplementary Users  : $members"
    fi

    echo "========================================"

    pause
}



##################################################
# Function : list_groups
# Purpose  : Display normal Linux groups
##################################################

list_groups() {

    header

    echo "========== Group List =========="
    echo

    gid_min=$(awk '/^[[:space:]]*GID_MIN[[:space:]]+/ {
        print $2
        exit
    }' /etc/login.defs)

    gid_min=${gid_min:-1000}

    printf "%-25s %-10s\n" "GROUP NAME" "GID"
    printf "%-25s %-10s\n" \
        "-------------------------" \
        "----------"

    awk -F: -v min="$gid_min" \
    '$3 >= min && $3 < 65534 {
        printf "%-25s %-10s\n", $1, $3
    }' /etc/group

    total=$(awk -F: -v min="$gid_min" \
    '$3 >= min && $3 < 65534 {count++}
     END {print count+0}' /etc/group)

    echo
    echo "----------------------------------------"
    echo "Total Groups : $total"

    pause
}



##################################################
# Function : group_menu
# Purpose  : Displays Group Management Menu
##################################################

group_menu() {

while true
do

header

echo "========== Group Management =========="
echo
echo "1. Create Group"
echo "2. Delete Group"
echo "3. Rename Group"
echo "4. Add User to Group"
echo "5. Remove User From Group"
echo "6. Group Information"
echo "7. List Groups"
echo
echo "0. Back"

echo

read -p "Choose Option : " choice

case $choice in

1)
create_group
;;

2)
delete_group
;;

3)
rename_group
;;

4)
add_user_to_group
;;

5)
remove_user_from_group
;;

6)
group_information
;;

7)
list_groups
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