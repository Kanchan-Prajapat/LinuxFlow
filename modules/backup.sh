#!/bin/bash

############################################
# Backup Management Module
############################################

##################################################
# Function : generate_backup_name
# Purpose  : Generate unique backup filename
##################################################

BACKUP_DIR="./backups"

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

    if [ ! -d "$source_dir" ]; then
        error "Directory does not exist."
        pause
        return
    fi

    mkdir -p "$BACKUP_DIR"

    backup_name=$(generate_backup_name)

    echo
    read -p "Create backup of '$source_dir'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if tar -czf "$BACKUP_DIR/$backup_name" "$source_dir"; then
                success "Backup created successfully."
                echo
                echo "Backup File : $BACKUP_DIR/$backup_name"
            else
                error "Backup creation failed."
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
# Purpose  : Restore a backup archive
##################################################

restore_backup() {

    header

    echo "========== Restore Backup =========="
    echo

    echo "Available Backups:"
    ls "$BACKUP_DIR"
    echo

    read -p "Enter backup file name: " backup_file

    if [ ! -f "$BACKUP_DIR/$backup_file" ]; then
        error "Backup file not found."
        pause
        return
    fi

    echo

    read -p "Enter destination directory: " destination

    if [ ! -d "$destination" ]; then
        error "Destination directory does not exist."
        pause
        return
    fi

    echo

    read -p "Restore '$backup_file' to '$destination'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if tar -xzf "$BACKUP_DIR/$backup_file" -C "$destination"; then
                success "Backup restored successfully."
            else
                error "Backup restore failed."
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
# Purpose  : Delete a backup archive
##################################################

delete_backup() {

    header

    echo "========== Delete Backup =========="
    echo

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR")" ]; then
        warning "No backups available."
        pause
        return
    fi

    echo "Available Backups:"
    find "$BACKUP_DIR" -maxdepth 1 -name "*.tar.gz" -exec basename {} \;
    echo

    read -p "Enter backup file name: " backup_file

    if [ ! -f "$BACKUP_DIR/$backup_file" ]; then
        error "Backup file not found."
        pause
        return
    fi

    echo

    read -p "Delete '$backup_file'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if rm "$BACKUP_DIR/$backup_file"; then
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

    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR")" ]; then
        warning "No backups available."
        pause
        return
    fi

    echo "Available Backups:"
    ls "$BACKUP_DIR"
    echo

    read -p "Enter backup file name: " backup_file

    if [ ! -f "$BACKUP_DIR/$backup_file" ]; then
        error "Backup file not found."
        pause
        return
    fi

    echo

    size=$(du -h "$BACKUP_DIR/$backup_file" | cut -f1)

    created=$(stat -c "%y" "$BACKUP_DIR/$backup_file")

    total_files=$(tar -tf "$BACKUP_DIR/$backup_file" | wc -l)

    echo "=========================================="
    echo "         Backup Information"
    echo "=========================================="

    echo "Backup Name    : $backup_file"
    echo "Backup Size    : $size"
    echo "Created On     : $created"
    echo "Total Files    : $total_files"

    echo
    echo "Archive Contents:"
    echo "----------------------------"

    tar -tf "$BACKUP_DIR/$backup_file"

    echo "=========================================="

    pause
}



##################################################
# Function : backup_menu
# Purpose  : Displays Group Management Menu
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