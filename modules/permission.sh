#!/bin/bash

############################################
# Permission Management Module
############################################


##################################################
# Function : validate_file
# Purpose  : Check if file exists
##################################################

validate_file() {

    local file="$1"

    if [ ! -e "$file" ]; then
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

    echo

    read -p "Enter permission (e.g. 755): " permission

    if ! validate_permission "$permission"; then
        pause
        return
    fi

    echo

    read -p "Change permission of '$filepath' to '$permission'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if chmod "$permission" "$filepath"; then
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

    echo

    read -p "Enter new owner: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    echo

    read -p "Change owner of '$filepath' to '$username'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if chown "$username" "$filepath"; then
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

    echo

    read -p "Enter new group: " groupname

    if ! validate_existing_group "$groupname"; then
        pause
        return
    fi

    echo

    read -p "Change group of '$filepath' to '$groupname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if chgrp "$groupname" "$filepath"; then
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
# Purpose  : Display file/directory permission information
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

    echo "Name               : $(basename "$filepath")"

    if [ -d "$filepath" ]; then
        echo "Type               : Directory"
    else
        echo "Type               : File"
    fi

    echo "Owner              : $(stat -c "%U" "$filepath")"
    echo "Group              : $(stat -c "%G" "$filepath")"
    echo "Permission         : $(stat -c "%A" "$filepath")"
    echo "Numeric Permission : $(stat -c "%a" "$filepath")"
    echo "Size               : $(stat -c "%s bytes" "$filepath")"
    echo "Last Modified      : $(stat -c "%y" "$filepath")"
    echo "Absolute Path      : $(realpath "$filepath")"
echo "Inode Number       : $(stat -c "%i" "$filepath")"
echo "Hard Links         : $(stat -c "%h" "$filepath")"

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

    if [ ! -d "$dirpath" ]; then
        error "Directory does not exist."
        pause
        return
    fi

    echo
    printf "%-30s %-12s %-12s %-10s %-10s\n" \
        "NAME" "OWNER" "GROUP" "PERMISSION" "SIZE"
    printf "%-30s %-12s %-12s %-10s %-10s\n" \
        "------------------------------" "------------" "------------" "----------" "----------"

    count=0

    while IFS= read -r file
    do
        printf "%-30s %-12s %-12s %-10s %-10s\n" \
            "$(basename "$file")" \
            "$(stat -c "%U" "$file")" \
            "$(stat -c "%G" "$file")" \
            "$(stat -c "%a" "$file")" \
            "$(du -sh "$file" 2>/dev/null | cut -f1)"

        ((count++))

    done < <(find "$dirpath" -maxdepth 1)

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