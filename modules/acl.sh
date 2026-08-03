#!/bin/bash

############################################
# ACL Management Module
############################################


##################################################
# Function : view_acl
# Purpose  : Display ACL information of a file
##################################################

view_acl() {

    header

    echo "========== View ACL =========="
    echo

    if ! command -v getfacl &>/dev/null; then
        error "ACL utilities are not installed."
        pause
        return
    fi

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    echo
    echo "========== ACL Information =========="
    echo

    getfacl "$filepath"

    pause
}


##################################################
# Function : validate_acl_permission
# Purpose  : Validate ACL permission format
##################################################

validate_acl_permission() {

    local permission="$1"

    if [[ ! "$permission" =~ ^[r-][w-][x-]$ ]]; then
        error "Invalid permission. Use format like rw-, r-x, rwx."
        return 1
    fi

    return 0
}



##################################################
# Function : set_user_acl
# Purpose  : Set ACL permission for a specific user
##################################################

set_user_acl() {

    header

    echo "========== Set User ACL =========="
    echo

    if ! command -v setfacl &>/dev/null; then
        error "ACL utilities are not installed."
        pause
        return
    fi

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    echo
    read -p "Enter username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    echo
    read -p "Enter permission (e.g. rw-, r-x, rwx): " permission

    if ! validate_acl_permission "$permission"; then
        pause
        return
    fi

    echo
    read -p "Set '$permission' ACL for user '$username'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if setfacl -m "u:${username}:${permission}" "$filepath"; then
                success "ACL set successfully for user '$username'."
            else
                error "Failed to set user ACL."
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
# Function : set_group_acl
# Purpose  : Set ACL permission for a specific group
##################################################

set_group_acl() {

    header

    echo "========== Set Group ACL =========="
    echo

    # Check ACL utility
    if ! command -v setfacl &>/dev/null; then
        error "ACL utilities are not installed."
        pause
        return
    fi

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    echo
    read -p "Enter group name: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    echo
    read -p "Enter permission (e.g. rw-, r-x, rwx): " permission

    if ! validate_acl_permission "$permission"; then
        pause
        return
    fi

    echo
    read -p "Set '$permission' ACL for group '$groupname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if setfacl -m "g:${groupname}:${permission}" "$filepath"; then
                success "ACL set successfully for group '$groupname'."
            else
                error "Failed to set group ACL."
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
# Function : remove_user_acl
# Purpose  : Remove ACL entry of a specific user
##################################################

remove_user_acl() {

    header

    echo "========== Remove User ACL =========="
    echo

    # Check ACL utility
    if ! command -v setfacl &>/dev/null; then
        error "ACL utilities are not installed."
        pause
        return
    fi

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    echo
    read -p "Enter username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    # Check whether user ACL exists
    if ! getfacl -cp "$filepath" 2>/dev/null |
        grep -q "^user:${username}:"; then

        warning "No ACL entry found for user '$username'."
        pause
        return
    fi

    echo
    read -p "Remove ACL for user '$username'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if setfacl -x "u:${username}" "$filepath"; then
                success "ACL removed successfully for user '$username'."
            else
                error "Failed to remove user ACL."
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
# Function : remove_group_acl
# Purpose  : Remove ACL entry of a specific group
##################################################

remove_group_acl() {

    header

    echo "========== Remove Group ACL =========="
    echo

    # Check ACL utility
    if ! command -v setfacl &>/dev/null; then
        error "ACL utilities are not installed."
        pause
        return
    fi

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    echo
    read -p "Enter group name: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    # Check whether group ACL exists
    if ! getfacl -cp "$filepath" 2>/dev/null |
        grep -q "^group:${groupname}:"; then

        warning "No ACL entry found for group '$groupname'."
        pause
        return
    fi

    echo
    read -p "Remove ACL for group '$groupname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if setfacl -x "g:${groupname}" "$filepath"; then
                success "ACL removed successfully for group '$groupname'."
            else
                error "Failed to remove group ACL."
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
# Function : remove_all_acl
# Purpose  : Remove all extended ACL entries
##################################################

remove_all_acl() {

    header

    echo "========== Remove All ACL =========="
    echo

    # Check ACL utility
    if ! command -v setfacl &>/dev/null; then
        error "ACL utilities are not installed."
        pause
        return
    fi

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    echo
    echo "Current ACL:"
    echo "----------------------------------------"
    getfacl "$filepath"

    echo
    warning "This will remove all extended ACL entries."
    echo

    read -p "Remove all ACL entries? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if setfacl -b "$filepath"; then
                success "All extended ACL entries removed successfully."
            else
                error "Failed to remove ACL entries."
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
# Function : acl_menu
# Purpose  : Displays ACL Management Menu
##################################################

acl_menu() {

    while true
    do

        header

        echo "========== ACL Management =========="
        echo
        echo "1. View ACL"
        echo "2. Set User ACL"
        echo "3. Set Group ACL"
        echo "4. Remove User ACL"
        echo "5. Remove Group ACL"
        echo "6. Remove All ACL"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                view_acl
                ;;

            2)
                set_user_acl
                ;;

            3)
                set_group_acl
                ;;

            4)
                remove_user_acl
                ;;

            5)
                remove_group_acl
                ;;

            6)
                remove_all_acl
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