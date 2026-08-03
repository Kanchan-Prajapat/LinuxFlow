#!/bin/bash

############################################
# LVM Management Module
############################################

##################################################
# Function : list_physical_volumes
# Purpose  : Display LVM physical volumes
##################################################

list_physical_volumes() {

    header

    echo "========== Physical Volumes =========="
    echo

    # Check whether LVM tools are installed
    if ! command -v pvs &>/dev/null; then
        error "LVM utilities are not installed."
        pause
        return
    fi

    # Check whether any physical volume exists
    if [ -z "$(pvs --noheadings 2>/dev/null)" ]; then
        warning "No physical volumes found."
        pause
        return
    fi

    pvs

    pause
}



##################################################
# Function : validate_block_device
# Purpose  : Validate block device for LVM
##################################################

validate_block_device() {

    local device="$1"

    # Empty check
    if [ -z "$device" ]; then
        error "Device path cannot be empty."
        return 1
    fi

    # Must be a block device
    if [ ! -b "$device" ]; then
        error "'$device' is not a valid block device."
        return 1
    fi

    return 0
}


##################################################
# Function : create_physical_volume
# Purpose  : Create an LVM physical volume
##################################################

create_physical_volume() {

    header

    echo "========== Create Physical Volume =========="
    echo

    if ! command -v pvcreate &>/dev/null; then
        error "LVM utilities are not installed."
        pause
        return
    fi

    echo "Available Block Devices:"
    echo "----------------------------------------"
    lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS

    echo
    read -p "Enter device path (e.g. /dev/sdb): " device

    if ! validate_block_device "$device"; then
        pause
        return
    fi

    # Already a physical volume?
    if pvs --noheadings -o pv_name 2>/dev/null |
        awk '{$1=$1};1' |
        grep -Fxq "$device"; then

        warning "'$device' is already a physical volume."
        pause
        return
    fi

    # Check whether device is mounted
    if findmnt -rn -S "$device" &>/dev/null; then
        error "'$device' is currently mounted."
        pause
        return
    fi

    echo
    warning "This operation will write LVM metadata to '$device'."
    echo

    read -p "Create physical volume on '$device'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if pvcreate "$device"; then
                success "Physical volume '$device' created successfully."
            else
                error "Failed to create physical volume."
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
# Function : list_volume_groups
# Purpose  : Display LVM volume groups
##################################################

list_volume_groups() {

    header

    echo "========== Volume Groups =========="
    echo

    # Check LVM utilities
    if ! command -v vgs &>/dev/null; then
        error "LVM utilities are not installed."
        pause
        return
    fi

    # Check whether any volume group exists
    if [ -z "$(vgs --noheadings 2>/dev/null)" ]; then
        warning "No volume groups found."
        pause
        return
    fi

    vgs

    pause
}


##################################################
# Function : validate_vg_name
# Purpose  : Validate volume group name
##################################################

validate_vg_name() {

    local vgname="$1"

    if [ -z "$vgname" ]; then
        error "Volume group name cannot be empty."
        return 1
    fi

    if [[ ! "$vgname" =~ ^[a-zA-Z0-9._+-]+$ ]]; then
        error "Invalid volume group name."
        return 1
    fi

    return 0
}



##################################################
# Function : create_volume_group
# Purpose  : Create a new LVM volume group
##################################################

create_volume_group() {

    header

    echo "========== Create Volume Group =========="
    echo

    if ! command -v vgcreate &>/dev/null; then
        error "LVM utilities are not installed."
        pause
        return
    fi

    echo "Available Physical Volumes:"
    echo "----------------------------------------"
    pvs
    echo

    read -p "Enter volume group name: " vgname

    if ! validate_vg_name "$vgname"; then
        pause
        return
    fi

    # Check whether VG already exists
    if vgs "$vgname" &>/dev/null; then
        error "Volume group '$vgname' already exists."
        pause
        return
    fi

    echo
    read -p "Enter physical volume path: " device

    if ! validate_block_device "$device"; then
        pause
        return
    fi

    # Check whether device is a Physical Volume
    if ! pvs --noheadings -o pv_name 2>/dev/null |
        awk '{$1=$1};1' |
        grep -Fxq "$device"; then

        error "'$device' is not a physical volume."
        pause
        return
    fi

    # Check whether PV already belongs to a VG
    existing_vg=$(pvs --noheadings -o vg_name "$device" 2>/dev/null |
        xargs)

    if [ -n "$existing_vg" ]; then
        error "'$device' already belongs to volume group '$existing_vg'."
        pause
        return
    fi

    echo
    read -p "Create volume group '$vgname' using '$device'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if vgcreate "$vgname" "$device"; then
                success "Volume group '$vgname' created successfully."
            else
                error "Failed to create volume group."
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
# Function : list_logical_volumes
# Purpose  : Display LVM logical volumes
##################################################

list_logical_volumes() {

    header

    echo "========== Logical Volumes =========="
    echo

    # Check LVM utilities
    if ! command -v lvs &>/dev/null; then
        error "LVM utilities are not installed."
        pause
        return
    fi

    # Check whether logical volumes exist
    if [ -z "$(lvs --noheadings 2>/dev/null)" ]; then
        warning "No logical volumes found."
        pause
        return
    fi

    lvs

    pause
}


##################################################
# Function : validate_lv_name
# Purpose  : Validate logical volume name
##################################################

validate_lv_name() {

    local lvname="$1"

    if [ -z "$lvname" ]; then
        error "Logical volume name cannot be empty."
        return 1
    fi

    if [[ ! "$lvname" =~ ^[a-zA-Z0-9._+-]+$ ]]; then
        error "Invalid logical volume name."
        return 1
    fi

    return 0
}


##################################################
# Function : validate_lv_size
# Purpose  : Validate logical volume size
##################################################

validate_lv_size() {

    local size="$1"

    if [[ ! "$size" =~ ^[1-9][0-9]*[MG]$ ]]; then
        error "Invalid size. Use format like 500M or 1G."
        return 1
    fi

    return 0
}


##################################################
# Function : create_logical_volume
# Purpose  : Create a new LVM logical volume
##################################################

create_logical_volume() {

    header

    echo "========== Create Logical Volume =========="
    echo

    if ! command -v lvcreate &>/dev/null; then
        error "LVM utilities are not installed."
        pause
        return
    fi

    echo "Available Volume Groups:"
    echo "----------------------------------------"
    vgs
    echo

    read -p "Enter volume group name: " vgname

    # Check VG exists
    if ! vgs "$vgname" &>/dev/null; then
        error "Volume group '$vgname' does not exist."
        pause
        return
    fi

    echo
    read -p "Enter logical volume name: " lvname

    if ! validate_lv_name "$lvname"; then
        pause
        return
    fi

    # Check LV already exists
    if lvs "$vgname/$lvname" &>/dev/null; then
        error "Logical volume '$lvname' already exists in '$vgname'."
        pause
        return
    fi

    echo
    echo "Volume Group Space:"
    vgs "$vgname" -o vg_name,vg_size,vg_free

    echo
    read -p "Enter logical volume size (e.g. 500M, 1G): " size

    if ! validate_lv_size "$size"; then
        pause
        return
    fi

    echo
    read -p "Create logical volume '$lvname' of size '$size' in '$vgname'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if lvcreate -L "$size" -n "$lvname" "$vgname"; then
                success "Logical volume '$lvname' created successfully."
            else
                error "Failed to create logical volume."
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
# Function : lvm_information
# Purpose  : Display complete LVM information
##################################################

lvm_information() {

    header

    echo "========== LVM Information =========="
    echo

    # Check LVM utilities
    if ! command -v pvs &>/dev/null ||
       ! command -v vgs &>/dev/null ||
       ! command -v lvs &>/dev/null; then

        error "LVM utilities are not installed."
        pause
        return
    fi

    echo "========== Physical Volumes =========="
    echo

    if [ -z "$(pvs --noheadings 2>/dev/null)" ]; then
        warning "No physical volumes found."
    else
        pvs
    fi

    echo
    echo "========== Volume Groups =========="
    echo

    if [ -z "$(vgs --noheadings 2>/dev/null)" ]; then
        warning "No volume groups found."
    else
        vgs
    fi

    echo
    echo "========== Logical Volumes =========="
    echo

    if [ -z "$(lvs --noheadings 2>/dev/null)" ]; then
        warning "No logical volumes found."
    else
        lvs
    fi

    pause
}



##################################################
# Function : create_filesystem
# Purpose  : Create XFS filesystem on logical volume
##################################################

create_filesystem() {

    header

    echo "========== Create Filesystem =========="
    echo

    # Check required utility
    if ! command -v mkfs.xfs &>/dev/null; then
        error "XFS filesystem utility is not installed."
        pause
        return
    fi

    echo "Available Logical Volumes:"
    echo "----------------------------------------"
    lvs -o lv_name,vg_name,lv_size
    echo

    read -p "Enter volume group name: " vgname

    # Check volume group
    if ! vgs "$vgname" &>/dev/null; then
        error "Volume group '$vgname' does not exist."
        pause
        return
    fi

    echo
    read -p "Enter logical volume name: " lvname

    # Check logical volume
    if ! lvs "$vgname/$lvname" &>/dev/null; then
        error "Logical volume '$lvname' does not exist in '$vgname'."
        pause
        return
    fi

    lv_path="/dev/$vgname/$lvname"

    # Check whether LV is mounted
    if findmnt -rn -S "$lv_path" &>/dev/null; then
        error "Logical volume '$lv_path' is currently mounted."
        pause
        return
    fi

    # Check existing filesystem
    filesystem=$(blkid -s TYPE -o value "$lv_path" 2>/dev/null)

    if [ -n "$filesystem" ]; then
        error "Logical volume already contains '$filesystem' filesystem."
        warning "LinuxFlow will not overwrite an existing filesystem."
        pause
        return
    fi

    echo
    echo "Logical Volume : $lv_path"
    echo "Filesystem     : XFS"
    echo

    warning "Creating a filesystem writes filesystem metadata to the logical volume."
    echo

    read -p "Create XFS filesystem on '$lv_path'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if mkfs.xfs "$lv_path"; then
                success "XFS filesystem created successfully."
            else
                error "Failed to create filesystem."
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
# Function : mount_logical_volume
# Purpose  : Mount logical volume to a directory
##################################################

mount_logical_volume() {

    header

    echo "========== Mount Logical Volume =========="
    echo

    echo "Available Logical Volumes:"
    echo "----------------------------------------"
    lvs -o lv_name,vg_name,lv_size
    echo

    read -p "Enter volume group name: " vgname

    if ! vgs "$vgname" &>/dev/null; then
        error "Volume group '$vgname' does not exist."
        pause
        return
    fi

    echo
    read -p "Enter logical volume name: " lvname

    if ! lvs "$vgname/$lvname" &>/dev/null; then
        error "Logical volume '$lvname' does not exist in '$vgname'."
        pause
        return
    fi

    lv_path="/dev/$vgname/$lvname"

    # Check filesystem
    filesystem=$(blkid -s TYPE -o value "$lv_path" 2>/dev/null)

    if [ -z "$filesystem" ]; then
        error "No filesystem found on '$lv_path'."
        warning "Create a filesystem before mounting."
        pause
        return
    fi

    # Check whether LV is already mounted
    current_mount=$(findmnt -rn -S "$lv_path" -o TARGET 2>/dev/null)

    if [ -n "$current_mount" ]; then
        warning "Logical volume is already mounted at '$current_mount'."
        pause
        return
    fi

    echo
    read -p "Enter mount point (e.g. /mnt/linuxflow): " mount_point

    if [ -z "$mount_point" ]; then
        error "Mount point cannot be empty."
        pause
        return
    fi

    # Require absolute path
    if [[ "$mount_point" != /* ]]; then
        error "Mount point must be an absolute path."
        pause
        return
    fi

    # Check if something is already mounted there
    if findmnt -rn -T "$mount_point" 2>/dev/null |
       awk -v target="$mount_point" '$1 == target {found=1} END {exit !found}'; then

        error "Something is already mounted at '$mount_point'."
        pause
        return
    fi

    echo
    echo "Logical Volume : $lv_path"
    echo "Filesystem     : $filesystem"
    echo "Mount Point    : $mount_point"
    echo

    read -p "Mount logical volume? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if ! mkdir -p "$mount_point"; then
                error "Failed to create mount point."
                pause
                return
            fi

            if mount "$lv_path" "$mount_point"; then
                success "Logical volume mounted successfully."

                echo
                echo "Mount Information:"
                echo "----------------------------------------"
                findmnt "$mount_point"
            else
                error "Failed to mount logical volume."
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
# Function : configure_persistent_mount
# Purpose  : Configure persistent mount using fstab
##################################################

configure_persistent_mount() {

    header

    echo "========== Configure Persistent Mount =========="
    echo

    echo "Available Logical Volumes:"
    echo "----------------------------------------"
    lvs -o lv_name,vg_name,lv_size
    echo

    read -p "Enter volume group name: " vgname

    if ! vgs "$vgname" &>/dev/null; then
        error "Volume group '$vgname' does not exist."
        pause
        return
    fi

    echo
    read -p "Enter logical volume name: " lvname

    if ! lvs "$vgname/$lvname" &>/dev/null; then
        error "Logical volume '$lvname' does not exist in '$vgname'."
        pause
        return
    fi

    lv_path="/dev/$vgname/$lvname"

    # Check filesystem
    filesystem=$(blkid -s TYPE -o value "$lv_path" 2>/dev/null)

    if [ -z "$filesystem" ]; then
        error "No filesystem found on '$lv_path'."
        warning "Create a filesystem first."
        pause
        return
    fi

    # Get filesystem UUID
    uuid=$(blkid -s UUID -o value "$lv_path" 2>/dev/null)

    if [ -z "$uuid" ]; then
        error "Unable to determine filesystem UUID."
        pause
        return
    fi

    echo
    read -p "Enter mount point (e.g. /mnt/linuxflow): " mount_point

    if [ -z "$mount_point" ]; then
        error "Mount point cannot be empty."
        pause
        return
    fi

    if [[ "$mount_point" != /* ]]; then
        error "Mount point must be an absolute path."
        pause
        return
    fi

    # Prevent duplicate UUID entry
    if grep -Eq "^[[:space:]]*UUID=${uuid}[[:space:]]" /etc/fstab; then
        warning "This logical volume already has an /etc/fstab entry."
        pause
        return
    fi

    # Prevent duplicate mount point
    if awk '!/^[[:space:]]*#/ && NF >= 2 {print $2}' /etc/fstab |
       grep -Fxq "$mount_point"; then

        error "Mount point '$mount_point' already exists in /etc/fstab."
        pause
        return
    fi

    echo
    echo "Logical Volume : $lv_path"
    echo "UUID           : $uuid"
    echo "Filesystem     : $filesystem"
    echo "Mount Point    : $mount_point"
    echo

    warning "LinuxFlow will modify /etc/fstab."
    echo

    read -p "Configure persistent mount? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            # Create mount point
            if ! mkdir -p "$mount_point"; then
                error "Failed to create mount point."
                pause
                return
            fi

            # Backup fstab
            backup_file="/etc/fstab.linuxflow.$(date +%Y%m%d_%H%M%S).bak"

            if ! cp -p /etc/fstab "$backup_file"; then
                error "Failed to backup /etc/fstab."
                pause
                return
            fi

            success "fstab backup created: $backup_file"

            # Add persistent mount entry
            echo "UUID=$uuid $mount_point $filesystem defaults 0 0" >> /etc/fstab

            # Validate fstab
            if mount -a; then

                success "Persistent mount configured successfully."

                echo
                echo "fstab Entry:"
                echo "----------------------------------------"
                echo "UUID=$uuid $mount_point $filesystem defaults 0 0"

                echo
                echo "Mount Information:"
                echo "----------------------------------------"
                findmnt "$mount_point"

            else

                error "fstab validation failed."
                warning "Restoring previous /etc/fstab..."

                cp -p "$backup_file" /etc/fstab

                success "Previous /etc/fstab restored."

                pause
                return
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
# Function : lvm_menu
# Purpose  : Displays LVM Management Menu
##################################################

lvm_menu() {

    while true
    do

        header

        echo "========== LVM Management =========="
        echo
        echo "1. List Physical Volumes"
        echo "2. Create Physical Volume"
        echo "3. List Volume Groups"
        echo "4. Create Volume Group"
        echo "5. List Logical Volumes"
        echo "6. Create Logical Volume"
        echo "7. Create Filesystem"
        echo "8. Mount Logical Volume"
        echo "9. Configure Persistent Mount"
        echo "10. LVM Information"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                list_physical_volumes
                ;;

            2)
                create_physical_volume
                ;;

            3)
                list_volume_groups
                ;;

            4)
                create_volume_group
                ;;

            5)
                list_logical_volumes
                ;;

            6)
                create_logical_volume
                ;;

            7)
                create_filesystem
                ;;

            8)
                mount_logical_volume
                ;;

            9)
                configure_persistent_mount
                ;;

            10)
                lvm_information
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