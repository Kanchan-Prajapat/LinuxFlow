#!/bin/bash

############################################
# Backup Management Module
############################################

##################################################
# Function : generate_backup_name
# Purpose  : Generate unique backup filename
##################################################

BACKUP_DIR="./backups"



##################################################
# Function : has_backups
# Purpose  : Check whether backup archives exist
##################################################

has_backups() {

    [ -d "$BACKUP_DIR" ] || return 1

    find "$BACKUP_DIR" \
        -maxdepth 1 \
        -type f \
        -name "*.tar.gz" \
        -print -quit 2>/dev/null |
        grep -q .
}


##################################################
# Function : validate_backup_filename
# Purpose  : Validate backup archive filename
##################################################

validate_backup_filename() {

    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        error "Backup file name cannot be empty."
        return 1
    fi

    # Prevent paths such as ../../file
    if [[ "$backup_file" != "$(basename "$backup_file")" ]]; then
        error "Invalid backup file name."
        return 1
    fi

    if [[ "$backup_file" != *.tar.gz ]]; then
        error "Invalid backup format. Only .tar.gz files are allowed."
        return 1
    fi

    return 0
}


generate_backup_name() {

    date +"backup_%Y%m%d_%H%M%S.tar.gz"

}

##################################################
# Function : create_backup
# Purpose  : Create compressed backup
##################################################

create_backup() {

    header

    echo "========== Create Backup =========="
    echo
    echo "Note: Enter the full path of the directory."
    echo

    read -p "Enter directory to backup: " source_dir

    if [ -z "$source_dir" ]; then
        error "Source directory cannot be empty."
        pause
        return
    fi

    if [ ! -d "$source_dir" ]; then
        error "Directory does not exist."
        pause
        return
    fi

    # Convert to absolute canonical path
    source_dir=$(realpath "$source_dir" 2>/dev/null)

    if [ -z "$source_dir" ]; then
        error "Unable to resolve source directory."
        pause
        return
    fi

    if ! mkdir -p "$BACKUP_DIR"; then
        error "Unable to create backup directory."
        pause
        return
    fi

    backup_name=$(generate_backup_name)

    echo
    echo "Source      : $source_dir"
    echo "Backup File : $BACKUP_DIR/$backup_name"
    echo

    read -p "Create backup of '$source_dir'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            # -C prevents storing absolute paths in archive
            parent_dir=$(dirname "$source_dir")
            source_name=$(basename "$source_dir")

            if tar -czf "$BACKUP_DIR/$backup_name" \
                -C "$parent_dir" "$source_name"; then

                success "Backup created successfully."

                echo
                echo "Backup File : $BACKUP_DIR/$backup_name"

            else

                error "Backup creation failed."

                # Remove incomplete archive
                rm -f "$BACKUP_DIR/$backup_name"
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
# Function : restore_backup
# Purpose  : Safely restore a backup archive
##################################################

restore_backup() {

    header

    echo "========== Restore Backup =========="
    echo

    if ! has_backups; then
        warning "No backups available."
        pause
        return
    fi

    echo "Available Backups:"
    echo "----------------------------------------"

    find "$BACKUP_DIR" \
        -maxdepth 1 \
        -type f \
        -name "*.tar.gz" \
        -exec basename {} \;

    echo

    read -p "Enter backup file name: " backup_file

    if ! validate_backup_filename "$backup_file"; then
        pause
        return
    fi

    archive="$BACKUP_DIR/$backup_file"

    if [ ! -f "$archive" ]; then
        error "Backup file not found."
        pause
        return
    fi

    ##################################################
    # Validate archive integrity
    ##################################################

    if ! tar -tzf "$archive" &>/dev/null; then
        error "Backup archive is invalid or corrupted."
        pause
        return
    fi

    ##################################################
    # Detect unsafe archive paths
    ##################################################

    if tar -tzf "$archive" |
        grep -Eq '(^/|(^|/)\.\.(/|$))'; then

        error "Unsafe paths detected inside backup archive."
        warning "Restore operation blocked."
        pause
        return
    fi

    echo
    read -p "Enter destination directory: " destination

    if [ -z "$destination" ]; then
        error "Destination directory cannot be empty."
        pause
        return
    fi

    if [ ! -d "$destination" ]; then
        error "Destination directory does not exist."
        pause
        return
    fi

    destination=$(realpath "$destination" 2>/dev/null)

    if [ -z "$destination" ]; then
        error "Unable to resolve destination directory."
        pause
        return
    fi

    echo
    echo "Backup      : $backup_file"
    echo "Destination : $destination"
    echo

    warning "Existing files will NOT be overwritten."
    echo

    read -p "Restore '$backup_file' to '$destination'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            # -k prevents overwriting existing files
            if tar -xzkf "$archive" -C "$destination"; then

                success "Backup restored successfully."

            else

                error "Backup restore failed."

                echo
                warning "Some files may already exist in the destination."
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
# Function : list_backup
# Purpose  : Display available backups
##################################################

list_backup() {

    header

    echo "========== Backup List =========="
    echo

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR")" ]; then
        warning "No backups available."
        pause
        return
    fi

    printf "%-35s %-10s %-20s\n" "BACKUP FILE" "SIZE" "CREATED"
    printf "%-35s %-10s %-20s\n" "-----------------------------------" "--------" "--------------------"

    for file in "$BACKUP_DIR"/*.tar.gz
    do
        size=$(du -h "$file" | cut -f1)
        created=$(date -r "$file" "+%d-%m-%Y %H:%M")

        printf "%-35s %-10s %-20s\n" \
            "$(basename "$file")" \
            "$size" \
            "$created"
    done

    total=$(find "$BACKUP_DIR" -maxdepth 1 -name "*.tar.gz" | wc -l)

    echo
    echo "-----------------------------------------------"
    echo "Total Backups : $total"

    pause
}

##################################################
# Function : delete_backup
# Purpose  : Delete a backup archive safely
##################################################

delete_backup() {

    header

    echo "========== Delete Backup =========="
    echo

    if ! has_backups; then
        warning "No backups available."
        pause
        return
    fi

    echo "Available Backups:"
    echo "----------------------------------------"

    find "$BACKUP_DIR" \
        -maxdepth 1 \
        -type f \
        -name "*.tar.gz" \
        -exec basename {} \;

    echo

    read -p "Enter backup file name: " backup_file

    if ! validate_backup_filename "$backup_file"; then
        pause
        return
    fi

    archive="$BACKUP_DIR/$backup_file"

    if [ ! -f "$archive" ]; then
        error "Backup file not found."
        pause
        return
    fi

    echo

    warning "This operation cannot be undone."
    echo

    read -p "Delete '$backup_file'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if rm -- "$archive"; then
                success "Backup deleted successfully."
            else
                error "Failed to delete backup."
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
# Function : backup_info
# Purpose  : Display backup information
##################################################

backup_info() {

    header

    echo "========== Backup Information =========="
    echo

    if ! has_backups; then
        warning "No backups available."
        pause
        return
    fi

    echo "Available Backups:"
    echo "----------------------------------------"

    find "$BACKUP_DIR" \
        -maxdepth 1 \
        -type f \
        -name "*.tar.gz" \
        -exec basename {} \;

    echo

    read -p "Enter backup file name: " backup_file

    if ! validate_backup_filename "$backup_file"; then
        pause
        return
    fi

    archive="$BACKUP_DIR/$backup_file"

    if [ ! -f "$archive" ]; then
        error "Backup file not found."
        pause
        return
    fi

    # Check archive integrity
    if ! tar -tzf "$archive" &>/dev/null; then
        error "Backup archive is invalid or corrupted."
        pause
        return
    fi

    size=$(du -h "$archive" | cut -f1)

    created=$(stat -c "%y" "$archive")

    total_files=$(tar -tzf "$archive" | wc -l)

    echo
    echo "=========================================="
    echo "         Backup Information"
    echo "=========================================="
    echo

    echo "Backup Name    : $backup_file"
    echo "Backup Size    : $size"
    echo "Created On     : $created"
    echo "Total Entries  : $total_files"

    echo
    echo "Archive Contents:"
    echo "------------------------------------------"

    tar -tzf "$archive"

    echo
    echo "=========================================="

    pause
}


##################################################
# Function : backup_menu
# Purpose  : Displays Backup Management Menu
##################################################

backup_menu() {

while true
do

header

echo "========== Backup Management =========="
echo
echo "1. Create Backup"
echo "2. Restore Backup"
echo "3. List Backup"
echo "4. Delete Backup"
echo "5. Backup Information"
echo
echo "0. Back"

echo

read -p "Choose Option : " choice

case $choice in

1)
create_backup
;;

2)
restore_backup
;;

3)
list_backup
;;

4)
delete_backup
;;

5)
backup_info
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