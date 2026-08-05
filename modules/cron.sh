#!/bin/bash

############################################
# Cron Management Module
############################################


##################################################
# Function : check_cron_installed
# Purpose  : Check whether cron utility is installed
##################################################

check_cron_installed() {

    if ! command -v crontab &>/dev/null; then
        error "Cron utility is not installed."
        return 1
    fi

    return 0
}


##################################################
# Function : get_cron_service
# Purpose  : Detect cron systemd service
##################################################

get_cron_service() {

    if systemctl list-unit-files crond.service \
        --no-legend 2>/dev/null |
        grep -q "^crond.service"; then

        echo "crond"

    elif systemctl list-unit-files cron.service \
        --no-legend 2>/dev/null |
        grep -q "^cron.service"; then

        echo "cron"

    else
        return 1
    fi
}


##################################################
# Function : cron_status
# Purpose  : Display cron service status
##################################################

cron_status() {

    header

    echo "========== Cron Service Status =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    cron_service=$(get_cron_service)

    if [ -z "$cron_service" ]; then
        error "Unable to detect cron systemd service."
        pause
        return
    fi

    active_status=$(systemctl is-active "$cron_service" 2>/dev/null)
    enabled_status=$(systemctl is-enabled "$cron_service" 2>/dev/null)

    echo "Cron Service    : $cron_service"
    echo "Active Status   : ${active_status:-unknown}"
    echo "Enabled Status  : ${enabled_status:-unknown}"

    echo
    echo "========== Cron Service Information =========="
    echo

    systemctl status "$cron_service" --no-pager

    pause
}



##################################################
# Function : list_user_cron_jobs
# Purpose  : Display cron jobs of a specific user
##################################################

list_user_cron_jobs() {

    header

    echo "========== User Cron Jobs =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    ##################################################
    # Read user's crontab
    ##################################################

    cron_data=$(crontab -u "$username" -l 2>/dev/null)

    if [ -z "$cron_data" ]; then
        warning "No cron jobs found for user '$username'."
        pause
        return
    fi

    echo
    echo "Cron Jobs for User : $username"
    echo "=============================================="
    echo

    ##################################################
    # Display cron jobs with line numbers
    ##################################################

    echo "$cron_data" | nl -ba

    echo
    echo "=============================================="

    ##################################################
    # Count actual cron jobs
    # Ignore blank lines and comments
    ##################################################

    total_jobs=$(echo "$cron_data" |
        awk '
            /^[[:space:]]*$/ {next}
            /^[[:space:]]*#/ {next}
            {count++}
            END {print count+0}
        ')

    echo "Total Active Entries : $total_jobs"

    pause
}


##################################################
# Function : validate_cron_field
# Purpose  : Validate basic cron schedule field
##################################################

validate_cron_field() {

    local value="$1"

    if [ -z "$value" ]; then
        error "Cron schedule field cannot be empty."
        return 1
    fi

    # Allows:
    # numbers, *, comma, dash and slash
    if [[ ! "$value" =~ ^[0-9*/,-]+$ ]]; then
        error "Invalid cron schedule field: '$value'."
        return 1
    fi

    return 0
}


##################################################
# Function : add_cron_job
# Purpose  : Add a cron job for a specific user
##################################################

add_cron_job() {

    header

    echo "========== Add Cron Job =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    echo
    echo "Enter Cron Schedule"
    echo "----------------------------------------"
    echo "Use * for any value."
    echo

    read -p "Minute       (0-59)  : " minute
    read -p "Hour         (0-23)  : " hour
    read -p "Day of Month (1-31)  : " day
    read -p "Month        (1-12)  : " month
    read -p "Day of Week  (0-7)   : " weekday

    ##################################################
    # Basic format validation
    ##################################################

    for field in \
        "$minute" \
        "$hour" \
        "$day" \
        "$month" \
        "$weekday"
    do

        if ! validate_cron_field "$field"; then
            pause
            return
        fi

    done

    ##################################################
    # Range validation for simple numeric values
    ##################################################

    if [[ "$minute" =~ ^[0-9]+$ ]] &&
       { [ "$minute" -lt 0 ] || [ "$minute" -gt 59 ]; }; then

        error "Minute must be between 0 and 59."
        pause
        return
    fi

    if [[ "$hour" =~ ^[0-9]+$ ]] &&
       { [ "$hour" -lt 0 ] || [ "$hour" -gt 23 ]; }; then

        error "Hour must be between 0 and 23."
        pause
        return
    fi

    if [[ "$day" =~ ^[0-9]+$ ]] &&
       { [ "$day" -lt 1 ] || [ "$day" -gt 31 ]; }; then

        error "Day of month must be between 1 and 31."
        pause
        return
    fi

    if [[ "$month" =~ ^[0-9]+$ ]] &&
       { [ "$month" -lt 1 ] || [ "$month" -gt 12 ]; }; then

        error "Month must be between 1 and 12."
        pause
        return
    fi

    if [[ "$weekday" =~ ^[0-9]+$ ]] &&
       { [ "$weekday" -lt 0 ] || [ "$weekday" -gt 7 ]; }; then

        error "Day of week must be between 0 and 7."
        pause
        return
    fi

    ##################################################
    # Read command
    ##################################################

    echo
    read -r -p "Enter command to execute: " command

    if [ -z "$command" ]; then
        error "Command cannot be empty."
        pause
        return
    fi

    ##################################################
    # Build cron entry
    ##################################################

    cron_entry="$minute $hour $day $month $weekday $command"

    echo
    echo "========== Cron Job =========="
    echo
    echo "User     : $username"
    echo "Schedule : $minute $hour $day $month $weekday"
    echo "Command  : $command"
    echo
    echo "Cron Entry:"
    echo "$cron_entry"

    ##################################################
    # Get existing crontab
    ##################################################

    existing_cron=$(crontab -u "$username" -l 2>/dev/null || true)

    ##################################################
    # Duplicate detection
    ##################################################

    if printf '%s\n' "$existing_cron" |
        grep -Fqx -- "$cron_entry"; then

        warning "This cron job already exists for user '$username'."
        pause
        return
    fi

    echo
    read -p "Add this cron job? (Y/N): " confirm

    case "$confirm" in

        Y|y)
            ;;

        N|n)
            warning "Operation cancelled."
            pause
            return
            ;;

        *)
            error "Invalid choice."
            pause
            return
            ;;
    esac

    ##################################################
    # Create backup directory
    ##################################################

    CRON_BACKUP_DIR="./backups/cron"

    if ! mkdir -p "$CRON_BACKUP_DIR"; then
        error "Unable to create cron backup directory."
        pause
        return
    fi

    ##################################################
    # Backup existing crontab
    ##################################################

    timestamp=$(date +"%Y%m%d_%H%M%S")

    backup_file="${CRON_BACKUP_DIR}/${username}_${timestamp}.cron"

    if [ -n "$existing_cron" ]; then

        if ! printf '%s\n' "$existing_cron" > "$backup_file"; then
            error "Failed to backup existing crontab."
            pause
            return
        fi

        success "Existing crontab backup created."
        echo "Backup : $backup_file"
    fi

    ##################################################
    # Create temporary crontab safely
    ##################################################

    temp_file=$(mktemp)

    if [ -z "$temp_file" ] || [ ! -f "$temp_file" ]; then
        error "Unable to create temporary file."
        pause
        return
    fi

    if [ -n "$existing_cron" ]; then
        printf '%s\n' "$existing_cron" > "$temp_file"
    fi

    printf '%s\n' "$cron_entry" >> "$temp_file"

    ##################################################
    # Install new crontab
    ##################################################

    if crontab -u "$username" "$temp_file"; then

        rm -f "$temp_file"

        success "Cron job added successfully."

        echo
        echo "User     : $username"
        echo "Schedule : $minute $hour $day $month $weekday"
        echo "Command  : $command"

    else

        rm -f "$temp_file"

        error "Failed to install cron job."

        if [ -f "$backup_file" ]; then
            warning "Existing crontab backup is available:"
            echo "$backup_file"
        fi

        pause
        return
    fi

    pause
}



##################################################
# Function : remove_cron_job
# Purpose  : Safely remove a user's cron job
##################################################

remove_cron_job() {

    header

    echo "========== Remove Cron Job =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    ##################################################
    # Get existing crontab
    ##################################################

    existing_cron=$(crontab -u "$username" -l 2>/dev/null || true)

    if [ -z "$existing_cron" ]; then
        warning "No cron jobs found for user '$username'."
        pause
        return
    fi

    ##################################################
    # Extract active cron jobs
    # Ignore comments and blank lines
    ##################################################

    mapfile -t cron_jobs < <(
        printf '%s\n' "$existing_cron" |
        awk '
            /^[[:space:]]*$/ {next}
            /^[[:space:]]*#/ {next}
            {print}
        '
    )

    if [ "${#cron_jobs[@]}" -eq 0 ]; then
        warning "No active cron jobs found for user '$username'."
        pause
        return
    fi

    echo
    echo "Active Cron Jobs:"
    echo "--------------------------------------------------"

    for i in "${!cron_jobs[@]}"
    do
        printf "%d. %s\n" "$((i + 1))" "${cron_jobs[$i]}"
    done

    echo "--------------------------------------------------"
    echo

    read -p "Enter cron job number to remove: " choice

    ##################################################
    # Validate selection
    ##################################################

    if [[ ! "$choice" =~ ^[0-9]+$ ]]; then
        error "Invalid cron job number."
        pause
        return
    fi

    if [ "$choice" -lt 1 ] ||
       [ "$choice" -gt "${#cron_jobs[@]}" ]; then

        error "Cron job number is out of range."
        pause
        return
    fi

    selected_job="${cron_jobs[$((choice - 1))]}"

    echo
    echo "Selected Cron Job:"
    echo "--------------------------------------------------"
    echo "$selected_job"
    echo "--------------------------------------------------"
    echo

    warning "This cron job will be removed for user '$username'."

    read -p "Remove this cron job? (Y/N): " confirm

    case "$confirm" in

        Y|y)
            ;;

        N|n)
            warning "Operation cancelled."
            pause
            return
            ;;

        *)
            error "Invalid choice."
            pause
            return
            ;;
    esac

    ##################################################
    # Create backup
    ##################################################

    CRON_BACKUP_DIR="./backups/cron"

    if ! mkdir -p "$CRON_BACKUP_DIR"; then
        error "Unable to create cron backup directory."
        pause
        return
    fi

    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="${CRON_BACKUP_DIR}/${username}_${timestamp}.cron"

    if ! printf '%s\n' "$existing_cron" > "$backup_file"; then
        error "Failed to backup existing crontab."
        pause
        return
    fi

    success "Crontab backup created."
    echo "Backup : $backup_file"

    ##################################################
    # Create new crontab
    ##################################################

    temp_file=$(mktemp)

    if [ -z "$temp_file" ] || [ ! -f "$temp_file" ]; then
        error "Unable to create temporary file."
        pause
        return
    fi

    ##################################################
    # Remove ONE exact occurrence of selected job
    #
    # Important:
    # This preserves comments, blank lines and all
    # other cron entries.
    ##################################################

    awk -v target="$selected_job" '
        BEGIN {
            removed = 0
        }

        {
            if (!removed && $0 == target) {
                removed = 1
                next
            }

            print
        }
    ' <<< "$existing_cron" > "$temp_file"

    ##################################################
    # Install modified crontab
    ##################################################

    if crontab -u "$username" "$temp_file"; then

        rm -f "$temp_file"

        success "Cron job removed successfully."

        echo
        echo "Removed Job:"
        echo "$selected_job"

    else

        rm -f "$temp_file"

        error "Failed to update crontab."
        warning "Attempting to restore previous crontab..."

        if crontab -u "$username" "$backup_file"; then
            success "Previous crontab restored successfully."
        else
            error "CRITICAL: Failed to restore previous crontab."
            echo "Backup available at:"
            echo "$backup_file"
        fi

        pause
        return
    fi

    ##################################################
    # Verification
    ##################################################

    updated_cron=$(crontab -u "$username" -l 2>/dev/null || true)

    old_count=$(printf '%s\n' "$existing_cron" |
        grep -Fxc -- "$selected_job")

    new_count=$(printf '%s\n' "$updated_cron" |
        grep -Fxc -- "$selected_job")

    if [ "$new_count" -ge "$old_count" ]; then

        error "Unable to verify cron job removal."
        warning "Restoring previous crontab..."

        if crontab -u "$username" "$backup_file"; then
            success "Previous crontab restored."
        else
            error "CRITICAL: Failed to restore previous crontab."
        fi

        pause
        return
    fi

    success "Cron job removal verified."

    pause
}



##################################################
# Function : view_cron_job_details
# Purpose  : Display detailed information of a cron job
##################################################

view_cron_job_details() {

    header

    echo "========== Cron Job Details =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    ##################################################
    # Read user's crontab
    ##################################################

    cron_data=$(crontab -u "$username" -l 2>/dev/null || true)

    if [ -z "$cron_data" ]; then
        warning "No cron jobs found for user '$username'."
        pause
        return
    fi

    ##################################################
    # Extract active cron jobs
    ##################################################

    mapfile -t cron_jobs < <(
        printf '%s\n' "$cron_data" |
        awk '
            /^[[:space:]]*$/ {next}
            /^[[:space:]]*#/ {next}
            {print}
        '
    )

    if [ "${#cron_jobs[@]}" -eq 0 ]; then
        warning "No active cron jobs found for user '$username'."
        pause
        return
    fi

    ##################################################
    # Display jobs
    ##################################################

    echo
    echo "Available Cron Jobs:"
    echo "--------------------------------------------------"

    for i in "${!cron_jobs[@]}"
    do
        printf "%d. %s\n" "$((i + 1))" "${cron_jobs[$i]}"
    done

    echo "--------------------------------------------------"
    echo

    read -p "Enter cron job number: " choice

    ##################################################
    # Validate selection
    ##################################################

    if [[ ! "$choice" =~ ^[0-9]+$ ]]; then
        error "Invalid cron job number."
        pause
        return
    fi

    if [ "$choice" -lt 1 ] ||
       [ "$choice" -gt "${#cron_jobs[@]}" ]; then

        error "Cron job number is out of range."
        pause
        return
    fi

    selected_job="${cron_jobs[$((choice - 1))]}"

    ##################################################
    # Handle special @ schedules
    ##################################################

    if [[ "$selected_job" =~ ^@(reboot|yearly|annually|monthly|weekly|daily|midnight|hourly)[[:space:]]+ ]]; then

        schedule=$(awk '{print $1}' <<< "$selected_job")
        command="${selected_job#* }"

        echo
        echo "=============================================="
        echo "             Cron Job Information"
        echo "=============================================="
        echo
        echo "User        : $username"
        echo "Schedule    : $schedule"
        echo "Command     : $command"
        echo
        echo "Full Entry  : $selected_job"
        echo
        echo "=============================================="

        pause
        return
    fi

    ##################################################
    # Parse standard cron entry
    ##################################################

    read -r minute hour day month weekday command \
        <<< "$selected_job"

    if [ -z "$command" ]; then
        error "Unable to parse selected cron entry."
        pause
        return
    fi

    ##################################################
    # Display information
    ##################################################

    echo
    echo "=============================================="
    echo "             Cron Job Information"
    echo "=============================================="
    echo

    echo "User          : $username"
    echo
    echo "Minute        : $minute"
    echo "Hour          : $hour"
    echo "Day of Month  : $day"
    echo "Month         : $month"
    echo "Day of Week   : $weekday"

    echo
    echo "Command       : $command"

    echo
    echo "Full Schedule : $minute $hour $day $month $weekday"

    echo
    echo "Full Entry    : $selected_job"

    echo
    echo "=============================================="

    pause
}



##################################################
# Function : list_system_cron_jobs
# Purpose  : Display system-wide cron jobs
##################################################

list_system_cron_jobs() {

    header

    echo "========== System Cron Jobs =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    ##################################################
    # /etc/crontab
    ##################################################

    echo "========== /etc/crontab =========="
    echo

    if [ -f /etc/crontab ]; then

        if grep -Ev \
            '^[[:space:]]*($|#)' /etc/crontab |
            grep -q .; then

            grep -Ev \
                '^[[:space:]]*($|#)' /etc/crontab

        else
            warning "No active entries found in /etc/crontab."
        fi

    else
        warning "/etc/crontab does not exist."
    fi

    echo


    ##################################################
    # /etc/cron.d
    ##################################################

    echo "========== /etc/cron.d =========="
    echo

    if [ -d /etc/cron.d ]; then

        found=0

        for file in /etc/cron.d/*
        do
            [ -f "$file" ] || continue

            found=1

            echo
            echo "File : $file"
            echo "----------------------------------------"

            if grep -Ev \
                '^[[:space:]]*($|#)' "$file" |
                grep -q .; then

                grep -Ev \
                    '^[[:space:]]*($|#)' "$file"

            else
                echo "No active entries."
            fi
        done

        if [ "$found" -eq 0 ]; then
            warning "No cron definition files found."
        fi

    else
        warning "/etc/cron.d directory does not exist."
    fi

    echo


    ##################################################
    # Periodic Cron Directories
    ##################################################

    echo "========== Periodic Cron Directories =========="
    echo

    cron_dirs=(
        "/etc/cron.hourly"
        "/etc/cron.daily"
        "/etc/cron.weekly"
        "/etc/cron.monthly"
    )

    for dir in "${cron_dirs[@]}"
    do

        echo
        echo "$dir"
        echo "----------------------------------------"

        if [ ! -d "$dir" ]; then
            warning "Directory does not exist."
            continue
        fi

        found=0

        for file in "$dir"/*
        do
            [ -f "$file" ] || continue

            found=1

            printf "%-35s" "$(basename "$file")"

            if [ -x "$file" ]; then
                echo "Executable"
            else
                echo "Not Executable"
            fi
        done

        if [ "$found" -eq 0 ]; then
            echo "No scheduled scripts found."
        fi

    done

    echo


    ##################################################
    # Anacron information
    ##################################################

    echo "========== Anacron Configuration =========="
    echo

    if [ -f /etc/anacrontab ]; then

        if grep -Ev \
            '^[[:space:]]*($|#)' /etc/anacrontab |
            grep -q .; then

            grep -Ev \
                '^[[:space:]]*($|#)' /etc/anacrontab

        else
            warning "No active Anacron entries found."
        fi

    else
        warning "/etc/anacrontab does not exist."
    fi

    echo
    echo "=============================================="

    pause
}


##################################################
# Function : backup_user_crontab
# Purpose  : Create manual backup of user's crontab
##################################################

backup_user_crontab() {

    header

    echo "========== Backup User Crontab =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    ##################################################
    # Check whether user has a crontab
    ##################################################

    cron_data=$(crontab -u "$username" -l 2>/dev/null || true)

    if [ -z "$cron_data" ]; then
        warning "No crontab found for user '$username'."
        pause
        return
    fi

    ##################################################
    # Show summary
    ##################################################

    total_jobs=$(printf '%s\n' "$cron_data" |
        awk '
            /^[[:space:]]*$/ {next}
            /^[[:space:]]*#/ {next}
            {count++}
            END {print count+0}
        ')

    echo
    echo "User        : $username"
    echo "Active Jobs : $total_jobs"
    echo

    read -p "Create backup of this crontab? (Y/N): " confirm

    case "$confirm" in

        Y|y)
            ;;

        N|n)
            warning "Operation cancelled."
            pause
            return
            ;;

        *)
            error "Invalid choice."
            pause
            return
            ;;
    esac

    ##################################################
    # Create backup directory
    ##################################################

    CRON_BACKUP_DIR="./backups/cron"

    if ! mkdir -p "$CRON_BACKUP_DIR"; then
        error "Unable to create cron backup directory."
        pause
        return
    fi

    ##################################################
    # Generate unique backup name
    ##################################################

    timestamp=$(date +"%Y%m%d_%H%M%S")

    backup_file="${CRON_BACKUP_DIR}/${username}_manual_${timestamp}.cron"

    ##################################################
    # Create backup
    ##################################################

    if printf '%s\n' "$cron_data" > "$backup_file"; then

        success "Crontab backup created successfully."

        echo
        echo "User        : $username"
        echo "Backup File : $backup_file"
        echo "Active Jobs : $total_jobs"

    else

        error "Failed to create crontab backup."
        pause
        return
    fi

    ##################################################
    # Verify backup
    ##################################################

    if [ ! -s "$backup_file" ]; then

        error "Backup verification failed."
        rm -f "$backup_file"

        pause
        return
    fi

    success "Backup verification completed."

    pause
}



##################################################
# Function : restore_user_crontab
# Purpose  : Safely restore user's crontab backup
##################################################

restore_user_crontab() {

    header

    echo "========== Restore User Crontab =========="
    echo

    if ! check_cron_installed; then
        pause
        return
    fi

    read -p "Enter Username: " username

    if ! validate_existing_user "$username"; then
        pause
        return
    fi

    CRON_BACKUP_DIR="./backups/cron"

    ##################################################
    # Check backup directory
    ##################################################

    if [ ! -d "$CRON_BACKUP_DIR" ]; then
        warning "Cron backup directory does not exist."
        pause
        return
    fi

    ##################################################
    # Find backups belonging to user
    ##################################################

    mapfile -t backup_files < <(
        find "$CRON_BACKUP_DIR" \
            -maxdepth 1 \
            -type f \
            -name "${username}_*.cron" \
            -printf "%f\n" 2>/dev/null |
        sort
    )

    if [ "${#backup_files[@]}" -eq 0 ]; then
        warning "No crontab backups found for user '$username'."
        pause
        return
    fi

    ##################################################
    # Display available backups
    ##################################################

    echo
    echo "Available Backups:"
    echo "--------------------------------------------------"

    for i in "${!backup_files[@]}"
    do
        backup="${backup_files[$i]}"
        filepath="$CRON_BACKUP_DIR/$backup"

        size=$(du -h "$filepath" 2>/dev/null | cut -f1)
        created=$(date -r "$filepath" "+%d-%m-%Y %H:%M:%S" 2>/dev/null)

        printf "%d. %-45s %-8s %s\n" \
            "$((i + 1))" \
            "$backup" \
            "$size" \
            "$created"
    done

    echo "--------------------------------------------------"
    echo

    read -p "Choose backup number: " choice

    ##################################################
    # Validate selection
    ##################################################

    if [[ ! "$choice" =~ ^[0-9]+$ ]]; then
        error "Invalid backup number."
        pause
        return
    fi

    if [ "$choice" -lt 1 ] ||
       [ "$choice" -gt "${#backup_files[@]}" ]; then

        error "Backup number is out of range."
        pause
        return
    fi

    selected_backup="${backup_files[$((choice - 1))]}"
    backup_path="$CRON_BACKUP_DIR/$selected_backup"

    ##################################################
    # Validate selected backup
    ##################################################

    if [ ! -f "$backup_path" ]; then
        error "Selected backup file does not exist."
        pause
        return
    fi

    if [ ! -s "$backup_path" ]; then
        error "Selected backup file is empty."
        pause
        return
    fi

    ##################################################
    # Preview selected backup
    ##################################################

    echo
    echo "========== Backup Preview =========="
    echo

    cat "$backup_path"

    echo
    echo "=============================================="
    echo
    echo "User        : $username"
    echo "Backup File : $selected_backup"
    echo

    warning "Restoring this backup will replace the current crontab."
    echo

    read -p "Type YES to restore this backup: " confirm

    if [ "$confirm" != "YES" ]; then
        warning "Operation cancelled."
        pause
        return
    fi

    ##################################################
    # Backup current crontab before restore
    ##################################################

    current_cron=$(crontab -u "$username" -l 2>/dev/null || true)

    timestamp=$(date +"%Y%m%d_%H%M%S")
    safety_backup="${CRON_BACKUP_DIR}/${username}_before_restore_${timestamp}.cron"

    had_current_crontab=0

    if [ -n "$current_cron" ]; then

        had_current_crontab=1

        if ! printf '%s\n' "$current_cron" > "$safety_backup"; then
            error "Unable to create safety backup."
            pause
            return
        fi

        success "Current crontab safety backup created."
        echo "Backup : $safety_backup"

    else

        echo
        warning "User currently has no crontab."
    fi

    ##################################################
    # Restore selected backup
    ##################################################

    echo
    echo "Restoring crontab..."

    if ! crontab -u "$username" "$backup_path"; then

        error "Failed to restore selected crontab."

        ##################################################
        # Rollback
        ##################################################

        if [ "$had_current_crontab" -eq 1 ] &&
           [ -f "$safety_backup" ]; then

            warning "Attempting to restore previous crontab..."

            if crontab -u "$username" "$safety_backup"; then
                success "Previous crontab restored."
            else
                error "CRITICAL: Failed to restore previous crontab."
                echo "Safety backup:"
                echo "$safety_backup"
            fi

        else

            # User originally had no crontab.
            # Remove anything partially installed.
            crontab -u "$username" -r 2>/dev/null || true

        fi

        pause
        return
    fi

    ##################################################
    # Verify restored crontab
    ##################################################

    restored_temp=$(mktemp)

    if [ -z "$restored_temp" ] || [ ! -f "$restored_temp" ]; then
        error "Unable to create verification file."
        pause
        return
    fi

    if ! crontab -u "$username" -l > "$restored_temp" 2>/dev/null; then

        rm -f "$restored_temp"

        error "Unable to read restored crontab."
        pause
        return
    fi

    if cmp -s "$backup_path" "$restored_temp"; then

        rm -f "$restored_temp"

        success "Crontab restored successfully."
        success "Restore verification completed."

        echo
        echo "User        : $username"
        echo "Restored    : $selected_backup"

    else

        rm -f "$restored_temp"

        error "Restore verification failed."
        warning "Attempting rollback..."

        if [ "$had_current_crontab" -eq 1 ] &&
           [ -f "$safety_backup" ]; then

            if crontab -u "$username" "$safety_backup"; then
                success "Previous crontab restored."
            else
                error "CRITICAL: Rollback failed."
                echo "Safety backup:"
                echo "$safety_backup"
            fi

        else

            if crontab -u "$username" -r 2>/dev/null; then
                success "Original empty crontab state restored."
            else
                error "Unable to restore original empty state."
            fi

        fi

        pause
        return
    fi

    pause
}



##################################################
# Function : cron_health_check
# Purpose  : Check cron service and configuration health
##################################################

cron_health_check() {

    header

    echo "========== Cron Health Check =========="
    echo

    issues=0
    warnings=0

    ##################################################
    # Check cron utility
    ##################################################

    echo "[1] Cron Utility"

    if command -v crontab &>/dev/null; then
        success "Cron utility is installed."
    else
        error "Cron utility is not installed."
        ((issues++))
    fi

    echo


    ##################################################
    # Detect cron service
    ##################################################

    echo "[2] Cron Service"

    cron_service=$(get_cron_service 2>/dev/null)

    if [ -z "$cron_service" ]; then

        error "Cron systemd service could not be detected."
        ((issues++))

    else

        echo "Service : $cron_service"

        if systemctl is-active --quiet "$cron_service"; then
            success "Cron service is active."
        else
            error "Cron service is not active."
            ((issues++))
        fi

        if systemctl is-enabled --quiet "$cron_service"; then
            success "Cron service is enabled at boot."
        else
            warning "Cron service is not enabled at boot."
            ((warnings++))
        fi

    fi

    echo


    ##################################################
    # Check /etc/crontab
    ##################################################

    echo "[3] System Crontab"

    if [ -f /etc/crontab ]; then

        success "/etc/crontab exists."

        owner=$(stat -c "%U" /etc/crontab 2>/dev/null)
        permission=$(stat -c "%a" /etc/crontab 2>/dev/null)

        echo "Owner      : $owner"
        echo "Permission : $permission"

        if [ "$owner" != "root" ]; then
            warning "/etc/crontab is not owned by root."
            ((warnings++))
        fi

        ##################################################
        # Detect unsafe write permissions
        ##################################################

        mode=$(stat -c "%a" /etc/crontab 2>/dev/null)

        if [[ "$mode" =~ ^[0-7]{3,4}$ ]]; then

            last_three="${mode: -3}"

            group_digit="${last_three:1:1}"
            other_digit="${last_three:2:1}"

            if (( (10#$group_digit & 2) != 0 )); then
                warning "/etc/crontab is group-writable."
                ((warnings++))
            fi

            if (( (10#$other_digit & 2) != 0 )); then
                warning "/etc/crontab is world-writable."
                ((warnings++))
            fi
        fi

    else

        warning "/etc/crontab does not exist."
        ((warnings++))

    fi

    echo


    ##################################################
    # Check cron directories
    ##################################################

    echo "[4] Cron Directories"

    cron_dirs=(
        "/etc/cron.d"
        "/etc/cron.hourly"
        "/etc/cron.daily"
        "/etc/cron.weekly"
        "/etc/cron.monthly"
    )

    for dir in "${cron_dirs[@]}"
    do

        if [ -d "$dir" ]; then
            success "$dir exists."
        else
            warning "$dir does not exist."
            ((warnings++))
        fi

    done

    echo


    ##################################################
    # Check cron spool directory
    ##################################################

    echo "[5] Cron Spool"

    cron_spool=""

    if [ -d /var/spool/cron ]; then
        cron_spool="/var/spool/cron"
    elif [ -d /var/spool/cron/crontabs ]; then
        cron_spool="/var/spool/cron/crontabs"
    fi

    if [ -n "$cron_spool" ]; then

        success "Cron spool directory found."
        echo "Location : $cron_spool"

    else

        warning "Cron spool directory could not be found."
        ((warnings++))
    fi

    echo


    ##################################################
    # Check recent service errors
    ##################################################

    echo "[6] Recent Cron Service Errors"

    if [ -n "$cron_service" ]; then

        recent_errors=$(journalctl \
            -u "$cron_service" \
            -p err \
            --since "24 hours ago" \
            --no-pager \
            2>/dev/null)

        if [ -n "$recent_errors" ] &&
           ! grep -q "^-- No entries --$" <<< "$recent_errors"; then

            warning "Recent cron service errors were found."
            ((warnings++))

            echo
            echo "----------------------------------------"
            echo "$recent_errors"
            echo "----------------------------------------"

        else

            success "No recent cron service errors found."

        fi

    else

        warning "Service error check skipped."
        ((warnings++))

    fi

    echo


    ##################################################
    # Check failed systemd state
    ##################################################

    echo "[7] Systemd Service State"

    if [ -n "$cron_service" ]; then

        if systemctl is-failed --quiet "$cron_service"; then

            error "Cron service is in failed state."
            ((issues++))

        else

            success "Cron service is not in failed state."

        fi

    else

        warning "Unable to check service state."
        ((warnings++))

    fi


    ##################################################
    # Health Summary
    ##################################################

    echo
    echo "=============================================="
    echo "              Health Summary"
    echo "=============================================="
    echo

    echo "Critical Issues : $issues"
    echo "Warnings        : $warnings"

    echo

    if [ "$issues" -eq 0 ] &&
       [ "$warnings" -eq 0 ]; then

        success "Cron subsystem appears healthy."

    elif [ "$issues" -eq 0 ]; then

        warning "Cron is operational, but some warnings were detected."

    else

        error "Cron health check detected problems requiring attention."

    fi

    echo
    echo "=============================================="

    pause
}



##################################################
# Function : cron_menu
# Purpose  : Display Cron Management Menu
##################################################

cron_menu() {

    while true
    do

        header

        echo "========== Cron Management =========="
        echo
        echo "1. Cron Service Status"
        echo "2. List User Cron Jobs"
        echo "3. Add Cron Job"
        echo "4. Remove Cron Job"
        echo "5. View Cron Job Details"
        echo "6. List System Cron Jobs"
        echo "7. Backup User Crontab"
        echo "8. Restore User Crontab"
        echo "9. Cron Health Check"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                cron_status
                ;;

            2)
                list_user_cron_jobs
                ;;

            3)
                add_cron_job
                ;;

            4)
                remove_cron_job
                ;;

            5)
                view_cron_job_details
                ;;

            6)
                list_system_cron_jobs
                ;;

            7)
                backup_user_crontab
                ;;

             8)
                restore_user_crontab
                ;;

            9)
                cron_health_check
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