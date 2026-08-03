#!/bin/bash

############################################
# Swap Management Module
############################################


##################################################
# Function : swap_status
# Purpose  : Display current swap and memory status
##################################################

swap_status() {

    header

    echo "========== Swap Status =========="
    echo

    echo "========== Memory Information =========="
    echo

    free -h

    echo
    echo "========== Active Swap =========="
    echo

    if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
        warning "No active swap is currently configured."
    else
        swapon --show
    fi

    echo
    echo "========================================"

    pause
}


##################################################
# Function : list_swap_areas
# Purpose  : Display all active swap areas
##################################################

list_swap_areas() {

    header

    echo "========== Active Swap Areas =========="
    echo

    if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then

        warning "No active swap areas found."
        pause
        return

    fi

    printf "%-30s %-12s %-12s %-12s %-10s\n" \
        "NAME" "TYPE" "SIZE" "USED" "PRIORITY"

    printf "%-30s %-12s %-12s %-12s %-10s\n" \
        "------------------------------" \
        "------------" \
        "------------" \
        "------------" \
        "----------"

    swapon --show \
        --noheadings \
        --bytes \
        --output=NAME,TYPE,SIZE,USED,PRIO |
    while read -r name type size used priority
    do

        size_h=$(numfmt --to=iec "$size" 2>/dev/null)
        used_h=$(numfmt --to=iec "$used" 2>/dev/null)

        printf "%-30s %-12s %-12s %-12s %-10s\n" \
            "$name" \
            "$type" \
            "${size_h:-$size}" \
            "${used_h:-$used}" \
            "$priority"

    done

    echo

    total=$(swapon --show --noheadings 2>/dev/null | wc -l)

    echo "----------------------------------------"
    echo "Total Active Swap Areas : $total"

    pause
}



##################################################
# Function : validate_swap_size
# Purpose  : Validate swap size in GB
##################################################

validate_swap_size() {

    local size="$1"

    if [ -z "$size" ]; then
        error "Swap size cannot be empty."
        return 1
    fi

    if [[ ! "$size" =~ ^[1-9][0-9]*$ ]]; then
        error "Invalid size. Enter size in GB (e.g. 1, 2, 4)."
        return 1
    fi

    # Prevent accidentally creating extremely large swap
    if [ "$size" -gt 64 ]; then
        error "Swap size cannot exceed 64 GB through LinuxFlow."
        return 1
    fi

    return 0
}


##################################################
# Function : create_swap_file
# Purpose  : Create and activate a new swap file
##################################################

create_swap_file() {

    header

    echo "========== Create Swap File =========="
    echo

    read -p "Enter swap file path (e.g. /swapfile): " swapfile

    if [ -z "$swapfile" ]; then
        error "Swap file path cannot be empty."
        pause
        return
    fi

    # Require absolute path
    if [[ "$swapfile" != /* ]]; then
        error "Please enter an absolute path."
        pause
        return
    fi

    if [ -e "$swapfile" ]; then
        error "File '$swapfile' already exists."
        pause
        return
    fi

    parent_dir=$(dirname -- "$swapfile")

    if [ ! -d "$parent_dir" ]; then
        error "Parent directory '$parent_dir' does not exist."
        pause
        return
    fi

    echo
    read -p "Enter swap size in GB: " size

    if ! validate_swap_size "$size"; then
        pause
        return
    fi

    ##################################################
    # Check available disk space
    ##################################################

    required_bytes=$((size * 1024 * 1024 * 1024))

    available_bytes=$(df --output=avail -B1 "$parent_dir" 2>/dev/null |
        tail -1 | tr -d ' ')

    if [[ ! "$available_bytes" =~ ^[0-9]+$ ]]; then
        error "Unable to determine available disk space."
        pause
        return
    fi

    if [ "$available_bytes" -lt "$required_bytes" ]; then
        error "Not enough disk space."

        echo
        echo "Requested : ${size} GB"
        echo "Available : $(numfmt --to=iec "$available_bytes" 2>/dev/null)"

        pause
        return
    fi

    echo
    echo "Swap File : $swapfile"
    echo "Swap Size : ${size} GB"
    echo
    warning "This will allocate disk space and activate it as swap."
    echo

    read -p "Create swap file? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            echo
            echo "Creating swap file..."

            ##################################################
            # Create swap file
            ##################################################

            if command -v fallocate &>/dev/null; then
                fallocate -l "${size}G" "$swapfile"
                create_status=$?
            else
                dd if=/dev/zero \
                   of="$swapfile" \
                   bs=1M \
                   count=$((size * 1024)) \
                   status=progress

                create_status=$?
            fi

            if [ "$create_status" -ne 0 ]; then
                error "Failed to create swap file."
                rm -f -- "$swapfile"
                pause
                return
            fi

            ##################################################
            # Secure permissions
            ##################################################

            if ! chmod 600 "$swapfile"; then
                error "Failed to secure swap file."
                rm -f -- "$swapfile"
                pause
                return
            fi

            ##################################################
            # Initialize swap
            ##################################################

            if ! mkswap "$swapfile"; then
                error "Failed to initialize swap file."
                rm -f -- "$swapfile"
                pause
                return
            fi

            ##################################################
            # Activate swap
            ##################################################

            if ! swapon "$swapfile"; then
                error "Failed to activate swap."
                rm -f -- "$swapfile"
                pause
                return
            fi

            success "Swap file created and activated successfully."

            echo
            echo "========== Swap Information =========="
            echo

            swapon --show

            echo
            warning "This swap is currently temporary."
            warning "Use 'Make Swap Persistent' to keep it after reboot."
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
# Function : make_swap_persistent
# Purpose  : Add swap entry safely to /etc/fstab
##################################################

make_swap_persistent() {

    header

    echo "========== Make Swap Persistent =========="
    echo

    echo "Active Swap Areas:"
    echo "----------------------------------------"

    if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
        warning "No active swap areas found."
        pause
        return
    fi

    swapon --show
    echo

    read -p "Enter swap file/device path: " swap_path

    if [ -z "$swap_path" ]; then
        error "Swap path cannot be empty."
        pause
        return
    fi

    ##################################################
    # Check path exists
    ##################################################

    if [ ! -e "$swap_path" ]; then
        error "Swap file/device '$swap_path' does not exist."
        pause
        return
    fi

    ##################################################
    # Verify it is currently active swap
    ##################################################

    if ! swapon --show=NAME --noheadings |
        awk '{$1=$1; print}' |
        grep -Fxq "$swap_path"; then

        error "'$swap_path' is not currently active as swap."
        warning "Enable the swap before making it persistent."
        pause
        return
    fi

    ##################################################
    # Check duplicate /etc/fstab entry
    ##################################################

    if awk '
        /^[[:space:]]*#/ {next}
        NF >= 3 && $3 == "swap" {print $1}
    ' /etc/fstab | grep -Fxq "$swap_path"; then

        warning "Swap is already configured in /etc/fstab."
        pause
        return
    fi

    echo
    echo "Swap Path : $swap_path"
    echo "FSTAB     : /etc/fstab"
    echo
    warning "This will configure the swap to activate automatically at boot."
    echo

    read -p "Make this swap persistent? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            ##################################################
            # Create /etc/fstab backup
            ##################################################

            timestamp=$(date +"%Y%m%d_%H%M%S")
            backup_file="/etc/fstab.linuxflow.${timestamp}.bak"

            if ! cp -a /etc/fstab "$backup_file"; then
                error "Failed to create /etc/fstab backup."
                pause
                return
            fi

            success "FSTAB backup created: $backup_file"

            ##################################################
            # Add swap entry
            ##################################################

            echo "$swap_path none swap defaults 0 0" >> /etc/fstab

            if [ $? -ne 0 ]; then

                error "Failed to update /etc/fstab."

                cp -a "$backup_file" /etc/fstab

                warning "Original /etc/fstab restored."

                pause
                return
            fi

            ##################################################
            # Validate fstab swap configuration
            ##################################################

            if swapon -a; then

                success "Swap persistence configured successfully."

                echo
                echo "FSTAB Entry:"
                echo "----------------------------------------"

                grep -F "$swap_path" /etc/fstab

            else

                error "Swap configuration validation failed."
                warning "Restoring previous /etc/fstab..."

                if cp -a "$backup_file" /etc/fstab; then
                    success "Original /etc/fstab restored successfully."
                else
                    error "CRITICAL: Failed to restore /etc/fstab."
                fi

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
# Function : enable_swap
# Purpose  : Enable an existing swap file/device
##################################################

enable_swap() {

    header

    echo "========== Enable Swap =========="
    echo

    read -p "Enter swap file/device path: " swap_path

    if [ -z "$swap_path" ]; then
        error "Swap path cannot be empty."
        pause
        return
    fi

    if [ ! -e "$swap_path" ]; then
        error "Swap file/device '$swap_path' does not exist."
        pause
        return
    fi

    ##################################################
    # Check if already active
    ##################################################

    if swapon --show=NAME --noheadings 2>/dev/null |
        awk '{$1=$1; print}' |
        grep -Fxq "$swap_path"; then

        warning "'$swap_path' is already active."
        pause
        return
    fi

    ##################################################
    # Verify swap signature
    ##################################################

    swap_type=$(blkid -s TYPE -o value "$swap_path" 2>/dev/null)

    if [ "$swap_type" != "swap" ]; then
        error "'$swap_path' is not initialized as swap."
        warning "Use Create Swap File to create a new swap area."
        pause
        return
    fi

    echo
    echo "Swap Path : $swap_path"
    echo

    read -p "Enable this swap? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if swapon "$swap_path"; then

                success "Swap enabled successfully."

                echo
                swapon --show

            else
                error "Failed to enable swap."
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
# Function : disable_swap
# Purpose  : Safely disable an active swap area
##################################################

disable_swap() {

    header

    echo "========== Disable Swap =========="
    echo

    if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
        warning "No active swap areas found."
        pause
        return
    fi

    echo "Active Swap Areas:"
    echo "----------------------------------------"
    swapon --show
    echo

    read -p "Enter swap file/device path: " swap_path

    if [ -z "$swap_path" ]; then
        error "Swap path cannot be empty."
        pause
        return
    fi

    ##################################################
    # Check active swap
    ##################################################

    if ! swapon --show=NAME --noheadings 2>/dev/null |
        awk '{$1=$1; print}' |
        grep -Fxq "$swap_path"; then

        warning "'$swap_path' is not currently active."
        pause
        return
    fi

    ##################################################
    # Get swap usage
    ##################################################

    swap_used=$(swapon --show=NAME,USED \
        --bytes \
        --noheadings 2>/dev/null |
        awk -v path="$swap_path" '$1 == path {print $2}')

    swap_used=${swap_used:-0}

    ##################################################
    # Get available RAM
    ##################################################

    available_ram=$(free -b |
        awk '/^Mem:/ {print $7}')

    if [[ ! "$available_ram" =~ ^[0-9]+$ ]]; then
        error "Unable to determine available memory."
        pause
        return
    fi

    echo
    echo "Swap Path       : $swap_path"
    echo "Swap Currently Used : $(numfmt --to=iec "$swap_used" 2>/dev/null)"
    echo "Available RAM   : $(numfmt --to=iec "$available_ram" 2>/dev/null)"

    ##################################################
    # Memory safety check
    ##################################################

    if [ "$swap_used" -gt "$available_ram" ]; then

        echo
        error "Not enough available RAM to safely disable this swap."
        warning "Disabling it may cause memory exhaustion."

        pause
        return
    fi

    echo

    if grep -Eq \
        "^[[:space:]]*$(printf '%s' "$swap_path" | sed 's/[][\/.^$*+?{}|()]/\\&/g')[[:space:]].*[[:space:]]swap[[:space:]]" \
        /etc/fstab; then

        warning "This swap appears to be configured in /etc/fstab."
        warning "Disabling it now does NOT remove its persistent configuration."
        warning "It may become active again after reboot."
        echo
    fi

    read -p "Disable this swap? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if swapoff "$swap_path"; then

                success "Swap disabled successfully."

                echo
                echo "Current Swap:"
                echo "----------------------------------------"

                if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
                    echo "No active swap areas."
                else
                    swapon --show
                fi

            else
                error "Failed to disable swap."
                warning "The system may not have enough available memory."
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
# Function : remove_swap_file
# Purpose  : Safely remove a swap file
##################################################

remove_swap_file() {

    header

    echo "========== Remove Swap File =========="
    echo

    read -p "Enter swap file path: " swap_path

    ##################################################
    # Basic validation
    ##################################################

    if [ -z "$swap_path" ]; then
        error "Swap file path cannot be empty."
        pause
        return
    fi

    if [[ "$swap_path" != /* ]]; then
        error "Please enter an absolute path."
        pause
        return
    fi

    if [ ! -e "$swap_path" ]; then
        error "Swap file '$swap_path' does not exist."
        pause
        return
    fi

    ##################################################
    # Only regular files can be deleted here
    ##################################################

    if [ ! -f "$swap_path" ]; then
        error "'$swap_path' is not a regular file."
        warning "LinuxFlow will not delete swap partitions or devices."
        pause
        return
    fi

    ##################################################
    # Check whether swap is active
    ##################################################

    active_swap=false

    if swapon --show=NAME --noheadings 2>/dev/null |
        awk '{$1=$1; print}' |
        grep -Fxq "$swap_path"; then

        active_swap=true
    fi

    ##################################################
    # Memory safety check if active
    ##################################################

    if [ "$active_swap" = true ]; then

        swap_used=$(swapon --show=NAME,USED \
            --bytes \
            --noheadings 2>/dev/null |
            awk -v path="$swap_path" '$1 == path {print $2}')

        swap_used=${swap_used:-0}

        available_ram=$(free -b |
            awk '/^Mem:/ {print $7}')

        if [[ ! "$available_ram" =~ ^[0-9]+$ ]]; then
            error "Unable to determine available memory."
            pause
            return
        fi

        echo
        echo "Swap Currently Used : $(numfmt --to=iec "$swap_used" 2>/dev/null)"
        echo "Available RAM       : $(numfmt --to=iec "$available_ram" 2>/dev/null)"

        if [ "$swap_used" -gt "$available_ram" ]; then

            echo
            error "Not enough available RAM to safely remove this swap."
            warning "Disable memory pressure before removing the swap."

            pause
            return
        fi
    fi

    ##################################################
    # Check fstab configuration
    ##################################################

    persistent=false

    if awk -v path="$swap_path" '
        /^[[:space:]]*#/ {next}

        NF >= 3 && $1 == path && $3 == "swap" {
            found=1
        }

        END {
            exit !found
        }
    ' /etc/fstab; then

        persistent=true
    fi

    ##################################################
    # Show information
    ##################################################

    echo
    echo "Swap File  : $swap_path"
    echo "Active     : $active_swap"
    echo "Persistent : $persistent"
    echo

    warning "This operation will permanently delete the swap file."

    if [ "$persistent" = true ]; then
        warning "Its /etc/fstab entry will also be removed."
    fi

    echo
    read -p "Type DELETE to permanently remove this swap file: " confirm

    if [ "$confirm" != "DELETE" ]; then
        warning "Operation cancelled."
        pause
        return
    fi

    ##################################################
    # Disable swap first
    ##################################################

    if [ "$active_swap" = true ]; then

        echo
        echo "Disabling swap..."

        if ! swapoff "$swap_path"; then
            error "Failed to disable swap."
            warning "Swap file was NOT deleted."
            pause
            return
        fi

        success "Swap disabled successfully."
    fi

    ##################################################
    # Remove persistent fstab entry
    ##################################################

    if [ "$persistent" = true ]; then

        timestamp=$(date +"%Y%m%d_%H%M%S")
        backup_file="/etc/fstab.linuxflow.${timestamp}.bak"

        echo
        echo "Creating /etc/fstab backup..."

        if ! cp -a /etc/fstab "$backup_file"; then

            error "Failed to backup /etc/fstab."

            # Restore active state if it was active
            if [ "$active_swap" = true ]; then
                swapon "$swap_path" 2>/dev/null
            fi

            pause
            return
        fi

        success "FSTAB backup created: $backup_file"

        temp_fstab=$(mktemp)

        if [ -z "$temp_fstab" ]; then
            error "Failed to create temporary file."

            if [ "$active_swap" = true ]; then
                swapon "$swap_path" 2>/dev/null
            fi

            pause
            return
        fi

        ##################################################
        # Remove exact swap entry
        ##################################################

        if ! awk -v path="$swap_path" '
            {
                if ($0 ~ /^[[:space:]]*#/) {
                    print
                    next
                }

                if (NF >= 3 && $1 == path && $3 == "swap") {
                    next
                }

                print
            }
        ' /etc/fstab > "$temp_fstab"; then

            error "Failed to process /etc/fstab."

            rm -f "$temp_fstab"

            if [ "$active_swap" = true ]; then
                swapon "$swap_path" 2>/dev/null
            fi

            pause
            return
        fi

        if ! cat "$temp_fstab" > /etc/fstab; then

            error "Failed to update /etc/fstab."

            cp -a "$backup_file" /etc/fstab
            rm -f "$temp_fstab"

            if [ "$active_swap" = true ]; then
                swapon "$swap_path" 2>/dev/null
            fi

            pause
            return
        fi

        rm -f "$temp_fstab"

        success "Swap entry removed from /etc/fstab."
    fi

    ##################################################
    # Delete swap file
    ##################################################

    echo
    echo "Deleting swap file..."

    if rm -- "$swap_path"; then

        success "Swap file removed successfully."

    else

        error "Failed to delete swap file."

        ##################################################
        # Restore fstab if we changed it
        ##################################################

        if [ "$persistent" = true ] &&
           [ -n "$backup_file" ] &&
           [ -f "$backup_file" ]; then

            warning "Restoring previous /etc/fstab..."

            cp -a "$backup_file" /etc/fstab
        fi

        ##################################################
        # Re-enable swap if originally active
        ##################################################

        if [ "$active_swap" = true ] &&
           [ -f "$swap_path" ]; then

            swapon "$swap_path" 2>/dev/null
        fi

        pause
        return
    fi

    ##################################################
    # Final verification
    ##################################################

    echo
    echo "========== Verification =========="
    echo

    if [ ! -e "$swap_path" ]; then
        echo "Swap File  : Removed"
    else
        echo "Swap File  : Still Exists"
    fi

    if swapon --show=NAME --noheadings 2>/dev/null |
        awk '{$1=$1; print}' |
        grep -Fxq "$swap_path"; then

        echo "Active     : Yes"
    else
        echo "Active     : No"
    fi

    if awk -v path="$swap_path" '
        /^[[:space:]]*#/ {next}
        NF >= 3 && $1 == path && $3 == "swap" {found=1}
        END {exit !found}
    ' /etc/fstab; then

        echo "FSTAB Entry: Present"

    else

        echo "FSTAB Entry: Removed"
    fi

    pause
}


##################################################
# Function : swap_information
# Purpose  : Display detailed swap information
##################################################

swap_information() {

    header

    echo "========== Swap Information =========="
    echo

    if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
        warning "No active swap areas found."
        pause
        return
    fi

    echo "Active Swap Areas:"
    echo "----------------------------------------"
    swapon --show
    echo

    read -p "Enter swap file/device path: " swap_path

    if [ -z "$swap_path" ]; then
        error "Swap path cannot be empty."
        pause
        return
    fi

    # Check whether selected swap is active
    if ! swapon --show=NAME --noheadings 2>/dev/null |
        awk '{$1=$1; print}' |
        grep -Fxq "$swap_path"; then

        error "'$swap_path' is not currently active as swap."
        pause
        return
    fi

    # Get swap information
    swap_info=$(swapon --show \
        --bytes \
        --noheadings \
        --output=NAME,TYPE,SIZE,USED,PRIO |
        awk -v path="$swap_path" '$1 == path')

    read -r name type size used priority <<< "$swap_info"

    size_h=$(numfmt --to=iec "$size" 2>/dev/null)
    used_h=$(numfmt --to=iec "$used" 2>/dev/null)

    free_bytes=$((size - used))
    free_h=$(numfmt --to=iec "$free_bytes" 2>/dev/null)

    # Check persistence
    if awk -v path="$swap_path" '
        /^[[:space:]]*#/ {next}

        NF >= 3 && $1 == path && $3 == "swap" {
            found=1
        }

        END {
            exit !found
        }
    ' /etc/fstab; then

        persistent="Yes"
    else
        persistent="No"
    fi

    echo
    echo "========================================"
    echo "          Swap Information"
    echo "========================================"

    echo "Path        : $name"
    echo "Type        : $type"
    echo "Size        : ${size_h:-$size}"
    echo "Used        : ${used_h:-$used}"
    echo "Free        : ${free_h:-$free_bytes}"
    echo "Priority    : $priority"
    echo "Active      : Yes"
    echo "Persistent  : $persistent"

    if [ -f "$swap_path" ]; then
        echo "Permission  : $(stat -c "%a" -- "$swap_path")"
        echo "Owner       : $(stat -c "%U" -- "$swap_path")"
    fi

    echo "========================================"

    pause
}


##################################################
# Function : swap_menu
# Purpose  : Display Swap Management Menu
##################################################

swap_menu() {

    while true
    do

        header

        echo "========== Swap Management =========="
        echo
        echo "1. Swap Status"
        echo "2. List Swap Areas"
        echo "3. Create Swap File"
        echo "4. Make Swap Persistent"
        echo "5. Enable Swap"
        echo "6. Disable Swap"
        echo "7. Remove Swap File"
        echo "8. Swap Information"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                swap_status
                ;;

            2)
                list_swap_areas
                ;;

            3)
                create_swap_file
                ;;

            4)
                make_swap_persistent
                ;;
            
            5)
                enable_swap
                ;;
            
            6) 
                disable_swap
                ;;
            
            7)
                remove_swap_file
                ;;

            8)
                swap_information
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



