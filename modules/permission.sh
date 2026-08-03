#!/bin/bash

############################################
# Permission Management Module
############################################

##################################################
# Function : validate_file
# Purpose  : Validate file or directory path
##################################################

validate_file() {

    local file="$1"

    if [ -z "$file" ]; then
        error "File or directory path cannot be empty."
        return 1
    fi

    if [ ! -e "$file" ] && [ ! -L "$file" ]; then
        error "File or directory does not exist."
        return 1
    fi

    return 0
}



##################################################
# Function : validate_permission
# Purpose  : Validate numeric permission
##################################################

validate_permission() {

    local permission="$1"

    if [[ ! "$permission" =~ ^[0-7]{3}$ ]]; then
        error "Invalid permission. Use values like 644, 755, 600."
        return 1
    fi

    return 0
}


##################################################
# Function : protect_critical_path
# Purpose  : Prevent modification of critical
#            system directories
##################################################

protect_critical_path() {

    local filepath="$1"
    local resolved_path

    resolved_path=$(realpath -m -- "$filepath" 2>/dev/null)

    if [ -z "$resolved_path" ]; then
        error "Unable to resolve path."
        return 1
    fi

    case "$resolved_path" in

        /|/bin|/boot|/dev|/etc|/lib|/lib64|/proc|/root|/run|/sbin|/sys|/usr|/var)

            error "Operation blocked on critical system path '$resolved_path'."
            warning "Modify a specific file or subdirectory instead."
            return 1
            ;;

    esac

    return 0
}


##################################################
# Function : change_permission
# Purpose  : Change file or directory permissions
##################################################

change_permission() {

    header

    echo "========== Change File Permission =========="
    echo

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    if ! protect_critical_path "$filepath"; then
        pause
        return
    fi

    # Do not follow symbolic links
    if [ -L "$filepath" ]; then
        error "Permission changes on symbolic links are not supported."
        pause
        return
    fi

    current_permission=$(stat -c "%a" -- "$filepath" 2>/dev/null)

    echo
    echo "Current Permission : $current_permission"
    echo

    read -p "Enter new permission (e.g. 755): " permission

    if ! validate_permission "$permission"; then
        pause
        return
    fi

    if [ "$current_permission" = "$permission" ]; then
        warning "Permission is already set to '$permission'."
        pause
        return
    fi

    echo
    echo "Path           : $filepath"
    echo "Old Permission : $current_permission"
    echo "New Permission : $permission"
    echo

    read -p "Change permission? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if chmod -- "$permission" "$filepath"; then
                success "Permission changed successfully."
            else
                error "Failed to change permission."
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
# Function : change_owner
# Purpose  : Change file/directory owner
##################################################

change_owner() {

    header

    echo "========== Change File Owner =========="
    echo

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    if ! protect_critical_path "$filepath"; then
        pause
        return
    fi

    if [ -L "$filepath" ]; then
        error "Ownership changes on symbolic links are not supported."
        pause
        return
    fi

    current_owner=$(stat -c "%U" -- "$filepath" 2>/dev/null)

    echo
    echo "Current Owner : $current_owner"
    echo

    read -p "Enter new owner: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    if [ "$current_owner" = "$username" ]; then
        warning "'$username' is already the owner of this file/directory."
        pause
        return
    fi

    echo
    echo "Path      : $filepath"
    echo "Old Owner : $current_owner"
    echo "New Owner : $username"
    echo

    read -p "Change owner? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if chown -- "$username" "$filepath"; then
                success "Owner changed successfully."
            else
                error "Failed to change owner."
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
# Function : change_group
# Purpose  : Change file/directory group ownership
##################################################

change_group() {

    header

    echo "========== Change Group Ownership =========="
    echo

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    if ! protect_critical_path "$filepath"; then
        pause
        return
    fi

    if [ -L "$filepath" ]; then
        error "Group ownership changes on symbolic links are not supported."
        pause
        return
    fi

    current_group=$(stat -c "%G" -- "$filepath" 2>/dev/null)

    echo
    echo "Current Group : $current_group"
    echo

    read -p "Enter new group: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    if [ "$current_group" = "$groupname" ]; then
        warning "'$groupname' is already the group owner."
        pause
        return
    fi

    echo
    echo "Path      : $filepath"
    echo "Old Group : $current_group"
    echo "New Group : $groupname"
    echo

    read -p "Change group ownership? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if chgrp -- "$groupname" "$filepath"; then
                success "Group ownership changed successfully."
            else
                error "Failed to change group ownership."
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
# Function : permission_information
# Purpose  : Display file/directory permission info
##################################################

permission_information() {

    header

    echo "========== File Permission Information =========="
    echo

    read -p "Enter file/directory path: " filepath

    if ! validate_file "$filepath"; then
        pause
        return
    fi

    echo
    echo "============== Information =============="
    echo

    echo "Name               : $(basename -- "$filepath")"

    if [ -L "$filepath" ]; then
        type="Symbolic Link"
    elif [ -d "$filepath" ]; then
        type="Directory"
    elif [ -f "$filepath" ]; then
        type="Regular File"
    else
        type="Special File"
    fi

    echo "Type               : $type"
    echo "Owner              : $(stat -c "%U" -- "$filepath")"
    echo "Group              : $(stat -c "%G" -- "$filepath")"
    echo "Permission         : $(stat -c "%A" -- "$filepath")"
    echo "Numeric Permission : $(stat -c "%a" -- "$filepath")"
    echo "Size               : $(stat -c "%s bytes" -- "$filepath")"
    echo "Last Modified      : $(stat -c "%y" -- "$filepath")"
    echo "Absolute Path      : $(realpath -m -- "$filepath")"
    echo "Inode Number       : $(stat -c "%i" -- "$filepath")"
    echo "Hard Links         : $(stat -c "%h" -- "$filepath")"

    if [ -L "$filepath" ]; then
        echo "Link Target         : $(readlink -- "$filepath")"
    fi

    echo
    echo "=========================================="

    pause
}



##################################################
# Function : list_file_permissions
# Purpose  : List permissions of files/directories
##################################################

list_file_permissions() {

    header

    echo "========== List File Permissions =========="
    echo

    read -p "Enter directory path: " dirpath

    if [ -z "$dirpath" ]; then
        error "Directory path cannot be empty."
        pause
        return
    fi

    if [ ! -d "$dirpath" ]; then
        error "Directory does not exist."
        pause
        return
    fi

    echo

    printf "%-30s %-12s %-12s %-12s %-10s\n" \
        "NAME" "OWNER" "GROUP" "PERMISSION" "SIZE"

    printf "%-30s %-12s %-12s %-12s %-10s\n" \
        "------------------------------" \
        "------------" \
        "------------" \
        "------------" \
        "----------"

    count=0

    while IFS= read -r -d '' file
    do

        printf "%-30s %-12s %-12s %-12s %-10s\n" \
            "$(basename -- "$file")" \
            "$(stat -c "%U" -- "$file")" \
            "$(stat -c "%G" -- "$file")" \
            "$(stat -c "%a" -- "$file")" \
            "$(du -sh -- "$file" 2>/dev/null | cut -f1)"

        ((count++))

    done < <(find "$dirpath" -mindepth 1 -maxdepth 1 -print0)

    echo
    echo "Total Items : $count"

    pause
}


##################################################
# Function : permission_menu
# Purpose  : Displays Permisson Management Menu
##################################################

permission_menu() {

    while true
    do

        header

        echo "========== Permission Management =========="
        echo
        echo "1. Change File Permission"
        echo "2. Change File Owner"
        echo "3. Change Group Ownership"
        echo "4. File Permission Information"
        echo "5. List File Permissions"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                change_permission
                ;;

            2)
                change_owner
                ;;

            3)
                change_group
                ;;

            4)
                permission_information
                ;;

            5)
                list_file_permissions
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