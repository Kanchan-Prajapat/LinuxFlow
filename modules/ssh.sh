#!/bin/bash

############################################
# SSH Management Module
############################################


##################################################
# Function : check_ssh_installed
# Purpose  : Check whether SSH server is installed
##################################################

check_ssh_installed() {

    if ! command -v sshd &>/dev/null; then
        error "OpenSSH Server is not installed."
        return 1
    fi

    return 0
}


##################################################
# Function : get_ssh_service
# Purpose  : Detect SSH systemd service name
##################################################

get_ssh_service() {

    if systemctl list-unit-files sshd.service &>/dev/null &&
       systemctl list-unit-files sshd.service --no-legend 2>/dev/null |
       grep -q "^sshd.service"; then

        echo "sshd"

    elif systemctl list-unit-files ssh.service &>/dev/null &&
         systemctl list-unit-files ssh.service --no-legend 2>/dev/null |
         grep -q "^ssh.service"; then

        echo "ssh"

    else
        return 1
    fi
}


##################################################
# Function : ssh_status
# Purpose  : Display SSH server status
##################################################

ssh_status() {

    header

    echo "========== SSH Status =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_service=$(get_ssh_service)

    if [ -z "$ssh_service" ]; then
        error "Unable to detect SSH systemd service."
        pause
        return
    fi

    active_status=$(systemctl is-active "$ssh_service" 2>/dev/null)
    enabled_status=$(systemctl is-enabled "$ssh_service" 2>/dev/null)

    echo "SSH Service    : $ssh_service"
    echo "Active Status  : ${active_status:-unknown}"
    echo "Enabled Status : ${enabled_status:-unknown}"

    echo
    echo "========== SSH Service Information =========="
    echo

    systemctl status "$ssh_service" --no-pager

    pause
}



##################################################
# Function : validate_ssh_port
# Purpose  : Validate SSH port number
##################################################

validate_ssh_port() {

    local port="$1"

    if [ -z "$port" ]; then
        error "Port number cannot be empty."
        return 1
    fi

    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        error "Port must contain numbers only."
        return 1
    fi

    if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        error "Port must be between 1 and 65535."
        return 1
    fi

    return 0
}



##################################################
# Function : get_current_ssh_port
# Purpose  : Get effective SSH port
##################################################

get_current_ssh_port() {

    local port

    port=$(sshd -T 2>/dev/null |
        awk '$1=="port" {print $2; exit}')

    echo "${port:-22}"
}



##################################################
# Function : change_ssh_port
# Purpose  : Safely change SSH server port
##################################################

change_ssh_port() {

    header

    echo "========== Change SSH Port =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_service=$(get_ssh_service)

    if [ -z "$ssh_service" ]; then
        error "Unable to detect SSH service."
        pause
        return
    fi

    config_file="/etc/ssh/sshd_config"

    if [ ! -f "$config_file" ]; then
        error "SSH configuration file not found."
        pause
        return
    fi

    ##################################################
    # Validate current SSH configuration
    ##################################################

    if ! sshd -t; then
        error "Current SSH configuration contains errors."
        warning "Fix the configuration before changing the port."
        pause
        return
    fi

    current_port=$(get_current_ssh_port)

    echo "Current SSH Port : $current_port"
    echo

    read -p "Enter new SSH port: " new_port

    if ! validate_ssh_port "$new_port"; then
        pause
        return
    fi

    if [ "$new_port" = "$current_port" ]; then
        warning "SSH is already configured on port '$new_port'."
        pause
        return
    fi

    ##################################################
    # Check whether new port is already in use
    ##################################################

    if ss -ltnH 2>/dev/null |
        awk '{print $4}' |
        grep -Eq "[:.]${new_port}$"; then

        error "Port '$new_port' is already in use."
        pause
        return
    fi

    echo
    echo "Current Port : $current_port"
    echo "New Port     : $new_port"
    echo

    warning "Changing the SSH port can affect remote access."
    warning "Keep the current SSH session open until the new port is tested."

    echo
    read -p "Type YES to continue: " confirm

    if [ "$confirm" != "YES" ]; then
        warning "Operation cancelled."
        pause
        return
    fi

    ##################################################
    # Backup SSH configuration
    ##################################################

    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="${config_file}.linuxflow.${timestamp}.bak"

    if ! cp -a "$config_file" "$backup_file"; then
        error "Failed to backup SSH configuration."
        pause
        return
    fi

    success "SSH configuration backup created."
    echo "Backup : $backup_file"

    ##################################################
    # Rollback tracking
    ##################################################

    firewall_port_added=0
    selinux_port_added=0
    firewall_zone=""

    ##################################################
    # Modify Port directive
    ##################################################

    if grep -Eq \
        '^[[:space:]]*Port[[:space:]]+' \
        "$config_file"; then

        if ! sed -i -E \
            "s/^[[:space:]]*Port[[:space:]]+.*/Port ${new_port}/" \
            "$config_file"; then

            error "Failed to update SSH configuration."

            cp -a "$backup_file" "$config_file"

            pause
            return
        fi

    else

        if ! {
            echo
            echo "# Managed by LinuxFlow"
            echo "Port ${new_port}"
        } >> "$config_file"; then

            error "Failed to update SSH configuration."

            cp -a "$backup_file" "$config_file"

            pause
            return
        fi

    fi

    ##################################################
    # Validate modified SSH configuration
    ##################################################

    echo
    echo "Validating SSH configuration..."

    if ! sshd -t; then

        error "New SSH configuration is invalid."
        warning "Restoring previous configuration..."

        if cp -a "$backup_file" "$config_file"; then
            success "Previous SSH configuration restored."
        else
            error "CRITICAL: Failed to restore SSH configuration."
        fi

        pause
        return
    fi

    success "SSH configuration validated successfully."

    ##################################################
    # Firewall handling
    ##################################################

    if systemctl is-active --quiet firewalld &&
       command -v firewall-cmd &>/dev/null; then

        firewall_zone=$(get_firewall_zone 2>/dev/null)

        if [ -z "$firewall_zone" ]; then

            error "Unable to determine firewall zone."
            warning "Restoring previous SSH configuration."

            cp -a "$backup_file" "$config_file"

            pause
            return
        fi

        echo
        echo "Firewall Zone : $firewall_zone"

        if ! firewall-cmd \
            --permanent \
            --zone="$firewall_zone" \
            --query-port="${new_port}/tcp" &>/dev/null; then

            echo "Allowing new SSH port through firewall..."

            if ! firewall-cmd \
                --permanent \
                --zone="$firewall_zone" \
                --add-port="${new_port}/tcp" >/dev/null; then

                error "Failed to add new SSH port to firewall."
                warning "Restoring previous SSH configuration."

                cp -a "$backup_file" "$config_file"

                pause
                return
            fi

            firewall_port_added=1

            ##################################################
            # Reload firewall
            ##################################################

            if ! firewall-cmd --reload >/dev/null; then

                error "Firewall reload failed."
                warning "Rolling back firewall configuration..."

                firewall-cmd \
                    --permanent \
                    --zone="$firewall_zone" \
                    --remove-port="${new_port}/tcp" \
                    >/dev/null 2>&1

                firewall-cmd --reload >/dev/null 2>&1

                firewall_port_added=0

                cp -a "$backup_file" "$config_file"

                warning "Previous SSH configuration restored."

                pause
                return
            fi

            success "Firewall port ${new_port}/tcp allowed."

        else

            echo
            success "Firewall already allows port ${new_port}/tcp."

        fi

    else

        echo
        warning "Firewalld is not active."
        warning "Make sure port ${new_port}/tcp is allowed by your firewall."

    fi

    ##################################################
    # SELinux SSH port handling
    ##################################################

    if command -v getenforce &>/dev/null &&
       [ "$(getenforce)" = "Enforcing" ]; then

        echo
        echo "SELinux Status : Enforcing"

        ##################################################
        # semanage must be available
        ##################################################

        if ! command -v semanage &>/dev/null; then

            error "SELinux is enforcing but 'semanage' is not available."
            warning "Install policycoreutils-python-utils before changing SSH port."
            warning "Rolling back changes..."

            ##################################################
            # Firewall rollback
            ##################################################

            if [ "$firewall_port_added" -eq 1 ]; then

                firewall-cmd \
                    --permanent \
                    --zone="$firewall_zone" \
                    --remove-port="${new_port}/tcp" \
                    >/dev/null 2>&1

                firewall-cmd --reload >/dev/null 2>&1
            fi

            ##################################################
            # SSH configuration rollback
            ##################################################

            cp -a "$backup_file" "$config_file"

            pause
            return
        fi

        ##################################################
        # Check whether SELinux already allows port
        ##################################################

        if ! semanage port -l 2>/dev/null |
            awk '$1 == "ssh_port_t" {print}' |
            grep -Eq "(^|[ ,])${new_port}([ ,]|$)"; then

            echo "Adding port $new_port to SELinux SSH policy..."

            if semanage port -a \
                -t ssh_port_t \
                -p tcp "$new_port"; then

                selinux_port_added=1

                success "SELinux SSH port policy updated."

            else

                error "Failed to add SSH port to SELinux policy."
                warning "Rolling back changes..."

                ##################################################
                # Firewall rollback
                ##################################################

                if [ "$firewall_port_added" -eq 1 ]; then

                    firewall-cmd \
                        --permanent \
                        --zone="$firewall_zone" \
                        --remove-port="${new_port}/tcp" \
                        >/dev/null 2>&1

                    firewall-cmd --reload >/dev/null 2>&1
                fi

                ##################################################
                # SSH configuration rollback
                ##################################################

                cp -a "$backup_file" "$config_file"

                pause
                return
            fi

        else

            success "SELinux already allows SSH on port $new_port."

        fi
    fi

    ##################################################
    # Restart SSH service
    ##################################################

    echo
    echo "Applying SSH configuration..."

    if ! systemctl restart "$ssh_service"; then

        error "Failed to restart SSH service."
        warning "Rolling back changes..."

        ##################################################
        # Restore SSH configuration
        ##################################################

        cp -a "$backup_file" "$config_file"

        ##################################################
        # SELinux rollback
        ##################################################

        if [ "$selinux_port_added" -eq 1 ]; then

            semanage port -d \
                -t ssh_port_t \
                -p tcp "$new_port" \
                >/dev/null 2>&1
        fi

        ##################################################
        # Firewall rollback
        ##################################################

        if [ "$firewall_port_added" -eq 1 ]; then

            firewall-cmd \
                --permanent \
                --zone="$firewall_zone" \
                --remove-port="${new_port}/tcp" \
                >/dev/null 2>&1

            firewall-cmd --reload >/dev/null 2>&1
        fi

        ##################################################
        # Restore previous SSH service state
        ##################################################

        systemctl restart "$ssh_service" 2>/dev/null

        warning "Previous SSH configuration restored."

        pause
        return
    fi

    ##################################################
    # Verify SSH service
    ##################################################

    if ! systemctl is-active --quiet "$ssh_service"; then

        error "SSH service is not active after configuration change."
        warning "Rolling back changes..."

        cp -a "$backup_file" "$config_file"

        if [ "$selinux_port_added" -eq 1 ]; then

            semanage port -d \
                -t ssh_port_t \
                -p tcp "$new_port" \
                >/dev/null 2>&1
        fi

        if [ "$firewall_port_added" -eq 1 ]; then

            firewall-cmd \
                --permanent \
                --zone="$firewall_zone" \
                --remove-port="${new_port}/tcp" \
                >/dev/null 2>&1

            firewall-cmd --reload >/dev/null 2>&1
        fi

        systemctl restart "$ssh_service" 2>/dev/null

        warning "Previous SSH configuration restored."

        pause
        return
    fi

    ##################################################
    # Verify SSH listening port
    ##################################################

    sleep 1

    if ! ss -ltnH 2>/dev/null |
        awk '{print $4}' |
        grep -Eq "[:.]${new_port}$"; then

        error "SSH is not listening on the expected port '$new_port'."
        warning "Rolling back changes..."

        ##################################################
        # Restore SSH configuration
        ##################################################

        cp -a "$backup_file" "$config_file"

        ##################################################
        # SELinux rollback
        ##################################################

        if [ "$selinux_port_added" -eq 1 ]; then

            semanage port -d \
                -t ssh_port_t \
                -p tcp "$new_port" \
                >/dev/null 2>&1
        fi

        ##################################################
        # Firewall rollback
        ##################################################

        if [ "$firewall_port_added" -eq 1 ]; then

            firewall-cmd \
                --permanent \
                --zone="$firewall_zone" \
                --remove-port="${new_port}/tcp" \
                >/dev/null 2>&1

            firewall-cmd --reload >/dev/null 2>&1
        fi

        ##################################################
        # Restart old SSH configuration
        ##################################################

        systemctl restart "$ssh_service" 2>/dev/null

        warning "Previous SSH configuration restored."

        pause
        return
    fi

    ##################################################
    # Success
    ##################################################

    success "SSH port changed successfully."

    echo
    echo "Old SSH Port : $current_port"
    echo "New SSH Port : $new_port"

    echo
    warning "IMPORTANT:"
    warning "Do not close your current SSH session yet."
    warning "Open another terminal and test the new SSH port first."

    echo
    echo "Test using:"
    echo
    echo "ssh -p $new_port <username>@<server-ip>"
    echo

    warning "The old firewall rule has NOT been removed automatically."
    warning "Remove it only after confirming the new SSH connection works."

    pause
}



##################################################
# Function : ssh_configuration
# Purpose  : Display important SSH configuration
##################################################

ssh_configuration() {

    header

    echo "========== SSH Configuration =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    if ! sshd -t 2>/dev/null; then
        error "Current SSH configuration contains errors."
        echo
        sshd -t
        pause
        return
    fi

    config=$(sshd -T 2>/dev/null)

    if [ -z "$config" ]; then
        error "Unable to read SSH configuration."
        pause
        return
    fi

    echo "SSH Config File       : /etc/ssh/sshd_config"
    echo

    echo "Port                  : $(echo "$config" | awk '$1=="port" {print $2; exit}')"

    echo "Permit Root Login     : $(echo "$config" |
        awk '$1=="permitrootlogin" {print $2; exit}')"

    echo "Password Auth         : $(echo "$config" |
        awk '$1=="passwordauthentication" {print $2; exit}')"

    echo "Public Key Auth       : $(echo "$config" |
        awk '$1=="pubkeyauthentication" {print $2; exit}')"

    echo "Permit Empty Password : $(echo "$config" |
        awk '$1=="permitemptypasswords" {print $2; exit}')"

    echo "Max Auth Tries        : $(echo "$config" |
        awk '$1=="maxauthtries" {print $2; exit}')"

    echo "X11 Forwarding        : $(echo "$config" |
        awk '$1=="x11forwarding" {print $2; exit}')"

    echo "TCP Forwarding        : $(echo "$config" |
        awk '$1=="allowtcpforwarding" {print $2; exit}')"

    echo
    echo "========================================"

    pause
}



##################################################
# Function : list_ssh_connections
# Purpose  : Display current SSH connections
##################################################

list_ssh_connections() {

    header

    echo "========== SSH Connections =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_port=$(sshd -T 2>/dev/null |
        awk '$1=="port" {print $2; exit}')

    ssh_port=${ssh_port:-22}

    echo "SSH Port : $ssh_port"
    echo

    echo "========== Logged In Users =========="
    echo

    who

    echo
    echo "========== SSH Network Connections =========="
    echo

    if command -v ss &>/dev/null; then

        ss -tnp 2>/dev/null |
            awk -v port=":$ssh_port" \
            'NR==1 || $4 ~ port || $5 ~ port'

    else

        warning "'ss' command is not available."

    fi

    pause
}


##################################################
# Function : manage_root_login
# Purpose  : Enable or disable SSH root login safely
##################################################

manage_root_login() {

    header

    echo "========== SSH Root Login Management =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_service=$(get_ssh_service)

    if [ -z "$ssh_service" ]; then
        error "Unable to detect SSH service."
        pause
        return
    fi

    config_file="/etc/ssh/sshd_config"

    if [ ! -f "$config_file" ]; then
        error "SSH configuration file not found."
        pause
        return
    fi

    ##################################################
    # Validate current SSH configuration
    ##################################################

    if ! sshd -t; then
        error "Current SSH configuration contains errors."
        warning "Fix the configuration before making changes."
        pause
        return
    fi

    ##################################################
    # Get current effective value
    ##################################################

    current_value=$(sshd -T 2>/dev/null |
        awk '$1=="permitrootlogin" {print $2; exit}')

    current_value=${current_value:-unknown}

    echo "Current PermitRootLogin : $current_value"
    echo

    echo "1. Enable Root SSH Login"
    echo "2. Disable Root SSH Login"
    echo
    echo "0. Cancel"
    echo

    read -p "Choose Option : " choice

    case "$choice" in

        1)
            new_value="yes"

            echo
            warning "Enabling direct root SSH login increases security risk."
            ;;

        2)
            new_value="no"
            ;;

        0)
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
    # Check whether already configured
    ##################################################

    if [ "$current_value" = "$new_value" ]; then
        warning "PermitRootLogin is already set to '$new_value'."
        pause
        return
    fi

    echo
    echo "Current Value : $current_value"
    echo "New Value     : $new_value"
    echo

    if [ "$new_value" = "no" ]; then
        warning "Root will no longer be able to log in directly through SSH."
        warning "Make sure another administrative user is available."
    fi

    echo
    read -p "Apply this SSH configuration change? (Y/N): " confirm

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
    # Backup configuration
    ##################################################

    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="${config_file}.linuxflow.${timestamp}.bak"

    if ! cp -a "$config_file" "$backup_file"; then
        error "Failed to backup SSH configuration."
        pause
        return
    fi

    success "SSH configuration backup created."
    echo "Backup : $backup_file"

    ##################################################
    # Modify PermitRootLogin
    ##################################################

    if grep -Eq \
        '^[[:space:]]*PermitRootLogin[[:space:]]+' \
        "$config_file"; then

        if ! sed -i -E \
            "s/^[[:space:]]*PermitRootLogin[[:space:]]+.*/PermitRootLogin ${new_value}/" \
            "$config_file"; then

            error "Failed to update SSH configuration."
            cp -a "$backup_file" "$config_file"
            pause
            return
        fi

    else

        if ! {
            echo
            echo "# Managed by LinuxFlow"
            echo "PermitRootLogin ${new_value}"
        } >> "$config_file"; then

            error "Failed to update SSH configuration."
            cp -a "$backup_file" "$config_file"
            pause
            return
        fi
    fi

    ##################################################
    # Validate new configuration
    ##################################################

    echo
    echo "Validating SSH configuration..."

    if ! sshd -t; then

        error "New SSH configuration is invalid."
        warning "Restoring previous configuration..."

        if cp -a "$backup_file" "$config_file"; then
            success "Previous SSH configuration restored."
        else
            error "CRITICAL: Failed to restore SSH configuration."
        fi

        pause
        return
    fi

    success "SSH configuration validated successfully."

    ##################################################
    # Restart SSH
    ##################################################

    echo
    echo "Applying SSH configuration..."

    if ! systemctl restart "$ssh_service"; then

        error "Failed to restart SSH service."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"

        systemctl restart "$ssh_service" 2>/dev/null

        warning "Previous SSH configuration restored."

        pause
        return
    fi

    ##################################################
    # Verify service
    ##################################################

    if ! systemctl is-active --quiet "$ssh_service"; then

        error "SSH service is not active."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"
        systemctl restart "$ssh_service" 2>/dev/null

        pause
        return
    fi

    ##################################################
    # Verify effective configuration
    ##################################################

    effective_value=$(sshd -T 2>/dev/null |
        awk '$1=="permitrootlogin" {print $2; exit}')

    if [ "$effective_value" != "$new_value" ]; then

        error "PermitRootLogin change did not become effective."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"
        systemctl restart "$ssh_service" 2>/dev/null

        pause
        return
    fi

    success "Root SSH login configuration updated successfully."

    echo
    echo "PermitRootLogin : $effective_value"

    pause
}



##################################################
# Function : manage_password_auth
# Purpose  : Enable or disable SSH password authentication
##################################################

manage_password_auth() {

    header

    echo "========== SSH Password Authentication =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_service=$(get_ssh_service)

    if [ -z "$ssh_service" ]; then
        error "Unable to detect SSH service."
        pause
        return
    fi

    config_file="/etc/ssh/sshd_config"

    if [ ! -f "$config_file" ]; then
        error "SSH configuration file not found."
        pause
        return
    fi

    ##################################################
    # Validate current configuration
    ##################################################

    if ! sshd -t; then
        error "Current SSH configuration contains errors."
        warning "Fix the configuration before making changes."
        pause
        return
    fi

    ##################################################
    # Get current effective value
    ##################################################

    current_value=$(sshd -T 2>/dev/null |
        awk '$1=="passwordauthentication" {print $2; exit}')

    current_value=${current_value:-unknown}

    echo "Current PasswordAuthentication : $current_value"
    echo

    echo "1. Enable Password Authentication"
    echo "2. Disable Password Authentication"
    echo
    echo "0. Cancel"
    echo

    read -p "Choose Option : " choice

    case "$choice" in

        1)
            new_value="yes"
            ;;

        2)
            new_value="no"

            echo
            warning "Disabling password authentication can block SSH access"
            warning "if public-key authentication is not configured."
            ;;

        0)
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
    # Already configured?
    ##################################################

    if [ "$current_value" = "$new_value" ]; then
        warning "PasswordAuthentication is already set to '$new_value'."
        pause
        return
    fi

    ##################################################
    # Extra safety when disabling password login
    ##################################################

    if [ "$new_value" = "no" ]; then

        public_key_auth=$(sshd -T 2>/dev/null |
            awk '$1=="pubkeyauthentication" {print $2; exit}')

        echo
        echo "Public Key Authentication : ${public_key_auth:-unknown}"
        echo

        if [ "$public_key_auth" != "yes" ]; then
            error "Public-key authentication is not enabled."
            warning "Disabling password authentication could block SSH access."
            pause
            return
        fi

        warning "Make sure you have already tested SSH key login."
        warning "Do not close your current SSH session until another login succeeds."
        echo

        read -p "Type YES to disable password authentication: " confirm

        if [ "$confirm" != "YES" ]; then
            warning "Operation cancelled."
            pause
            return
        fi

    else

        echo
        read -p "Enable SSH password authentication? (Y/N): " confirm

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
    fi

    ##################################################
    # Backup SSH configuration
    ##################################################

    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="${config_file}.linuxflow.${timestamp}.bak"

    if ! cp -a "$config_file" "$backup_file"; then
        error "Failed to backup SSH configuration."
        pause
        return
    fi

    success "SSH configuration backup created."
    echo "Backup : $backup_file"

    ##################################################
    # Modify PasswordAuthentication
    ##################################################

    if grep -Eq \
        '^[[:space:]]*PasswordAuthentication[[:space:]]+' \
        "$config_file"; then

        if ! sed -i -E \
            "s/^[[:space:]]*PasswordAuthentication[[:space:]]+.*/PasswordAuthentication ${new_value}/" \
            "$config_file"; then

            error "Failed to update SSH configuration."
            cp -a "$backup_file" "$config_file"
            pause
            return
        fi

    else

        if ! {
            echo
            echo "# Managed by LinuxFlow"
            echo "PasswordAuthentication ${new_value}"
        } >> "$config_file"; then

            error "Failed to update SSH configuration."
            cp -a "$backup_file" "$config_file"
            pause
            return
        fi
    fi

    ##################################################
    # Validate modified configuration
    ##################################################

    echo
    echo "Validating SSH configuration..."

    if ! sshd -t; then

        error "New SSH configuration is invalid."
        warning "Restoring previous configuration..."

        if cp -a "$backup_file" "$config_file"; then
            success "Previous SSH configuration restored."
        else
            error "CRITICAL: Failed to restore SSH configuration."
        fi

        pause
        return
    fi

    success "SSH configuration validated successfully."

    ##################################################
    # Restart SSH
    ##################################################

    echo
    echo "Applying SSH configuration..."

    if ! systemctl restart "$ssh_service"; then

        error "Failed to restart SSH service."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"
        systemctl restart "$ssh_service" 2>/dev/null

        warning "Previous SSH configuration restored."

        pause
        return
    fi

    ##################################################
    # Verify service
    ##################################################

    if ! systemctl is-active --quiet "$ssh_service"; then

        error "SSH service is not active."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"
        systemctl restart "$ssh_service" 2>/dev/null

        pause
        return
    fi

    ##################################################
    # Verify effective value
    ##################################################

    effective_value=$(sshd -T 2>/dev/null |
        awk '$1=="passwordauthentication" {print $2; exit}')

    if [ "$effective_value" != "$new_value" ]; then

        error "PasswordAuthentication change did not become effective."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"
        systemctl restart "$ssh_service" 2>/dev/null

        pause
        return
    fi

    success "SSH password authentication updated successfully."

    echo
    echo "PasswordAuthentication : $effective_value"

    if [ "$new_value" = "no" ]; then
        echo
        warning "Keep this session open and test SSH key login from another terminal."
    fi

    pause
}



##################################################
# Function : manage_public_key_auth
# Purpose  : Enable or disable SSH public key authentication
##################################################

manage_public_key_auth() {

    header

    echo "========== SSH Public Key Authentication =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_service=$(get_ssh_service)

    if [ -z "$ssh_service" ]; then
        error "Unable to detect SSH service."
        pause
        return
    fi

    config_file="/etc/ssh/sshd_config"

    if [ ! -f "$config_file" ]; then
        error "SSH configuration file not found."
        pause
        return
    fi

    ##################################################
    # Validate current configuration
    ##################################################

    if ! sshd -t; then
        error "Current SSH configuration contains errors."
        warning "Fix the configuration before making changes."
        pause
        return
    fi

    ##################################################
    # Get current effective value
    ##################################################

    current_value=$(sshd -T 2>/dev/null |
        awk '$1=="pubkeyauthentication" {print $2; exit}')

    current_value=${current_value:-unknown}

    echo "Current PubkeyAuthentication : $current_value"
    echo

    echo "1. Enable Public Key Authentication"
    echo "2. Disable Public Key Authentication"
    echo
    echo "0. Cancel"
    echo

    read -p "Choose Option : " choice

    case "$choice" in

        1)
            new_value="yes"
            ;;

        2)
            new_value="no"

            echo
            warning "Disabling public key authentication may block SSH access"
            warning "if password authentication is also disabled."
            ;;

        0)
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
    # Already configured?
    ##################################################

    if [ "$current_value" = "$new_value" ]; then
        warning "PubkeyAuthentication is already set to '$new_value'."
        pause
        return
    fi

    ##################################################
    # Safety check before disabling
    ##################################################

    if [ "$new_value" = "no" ]; then

        password_auth=$(sshd -T 2>/dev/null |
            awk '$1=="passwordauthentication" {print $2; exit}')

        echo
        echo "Password Authentication : ${password_auth:-unknown}"
        echo

        if [ "$password_auth" != "yes" ]; then

            error "Password authentication is not enabled."
            warning "Disabling public key authentication could block SSH access."

            pause
            return
        fi

        warning "SSH key authentication will stop working."
        echo

        read -p "Type YES to disable public key authentication: " confirm

        if [ "$confirm" != "YES" ]; then
            warning "Operation cancelled."
            pause
            return
        fi

    else

        echo
        read -p "Enable public key authentication? (Y/N): " confirm

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
    fi

    ##################################################
    # Backup SSH configuration
    ##################################################

    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="${config_file}.linuxflow.${timestamp}.bak"

    if ! cp -a "$config_file" "$backup_file"; then
        error "Failed to backup SSH configuration."
        pause
        return
    fi

    success "SSH configuration backup created."
    echo "Backup : $backup_file"

    ##################################################
    # Modify PubkeyAuthentication
    ##################################################

    if grep -Eq \
        '^[[:space:]]*PubkeyAuthentication[[:space:]]+' \
        "$config_file"; then

        if ! sed -i -E \
            "s/^[[:space:]]*PubkeyAuthentication[[:space:]]+.*/PubkeyAuthentication ${new_value}/" \
            "$config_file"; then

            error "Failed to update SSH configuration."

            cp -a "$backup_file" "$config_file"

            pause
            return
        fi

    else

        if ! {
            echo
            echo "# Managed by LinuxFlow"
            echo "PubkeyAuthentication ${new_value}"
        } >> "$config_file"; then

            error "Failed to update SSH configuration."

            cp -a "$backup_file" "$config_file"

            pause
            return
        fi
    fi

    ##################################################
    # Validate new configuration
    ##################################################

    echo
    echo "Validating SSH configuration..."

    if ! sshd -t; then

        error "New SSH configuration is invalid."
        warning "Restoring previous configuration..."

        if cp -a "$backup_file" "$config_file"; then
            success "Previous SSH configuration restored."
        else
            error "CRITICAL: Failed to restore SSH configuration."
        fi

        pause
        return
    fi

    success "SSH configuration validated successfully."

    ##################################################
    # Restart SSH service
    ##################################################

    echo
    echo "Applying SSH configuration..."

    if ! systemctl restart "$ssh_service"; then

        error "Failed to restart SSH service."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"

        systemctl restart "$ssh_service" 2>/dev/null

        warning "Previous SSH configuration restored."

        pause
        return
    fi

    ##################################################
    # Verify SSH service
    ##################################################

    if ! systemctl is-active --quiet "$ssh_service"; then

        error "SSH service is not active."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"

        systemctl restart "$ssh_service" 2>/dev/null

        pause
        return
    fi

    ##################################################
    # Verify effective configuration
    ##################################################

    effective_value=$(sshd -T 2>/dev/null |
        awk '$1=="pubkeyauthentication" {print $2; exit}')

    if [ "$effective_value" != "$new_value" ]; then

        error "PubkeyAuthentication change did not become effective."
        warning "Restoring previous configuration..."

        cp -a "$backup_file" "$config_file"

        systemctl restart "$ssh_service" 2>/dev/null

        pause
        return
    fi

    success "Public key authentication updated successfully."

    echo
    echo "PubkeyAuthentication : $effective_value"

    if [ "$new_value" = "no" ]; then
        echo
        warning "Keep the current SSH session open until another login is tested."
    fi

    pause
}



##################################################
# Function : list_ssh_backups
# Purpose  : Display SSH configuration backups
##################################################

list_ssh_backups() {

    header

    echo "========== SSH Configuration Backups =========="
    echo

    config_file="/etc/ssh/sshd_config"

    shopt -s nullglob
    backups=("${config_file}".linuxflow.*.bak)
    shopt -u nullglob

    if [ "${#backups[@]}" -eq 0 ]; then
        warning "No LinuxFlow SSH configuration backups found."
        pause
        return
    fi

    printf "%-5s %-55s %-20s\n" \
        "NO." "BACKUP FILE" "CREATED"

    printf "%-5s %-55s %-20s\n" \
        "-----" \
        "-------------------------------------------------------" \
        "--------------------"

    count=1

    for backup in "${backups[@]}"
    do
        created=$(date -r "$backup" "+%d-%m-%Y %H:%M:%S")

        printf "%-5s %-55s %-20s\n" \
            "$count" \
            "$(basename "$backup")" \
            "$created"

        ((count++))
    done

    echo
    echo "Total Backups : ${#backups[@]}"

    pause
}




##################################################
# Function : restore_ssh_backup
# Purpose  : Safely restore SSH configuration backup
##################################################

restore_ssh_backup() {

    header

    echo "========== Restore SSH Configuration =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_service=$(get_ssh_service)

    if [ -z "$ssh_service" ]; then
        error "Unable to detect SSH service."
        pause
        return
    fi

    config_file="/etc/ssh/sshd_config"

    ##################################################
    # Find available backups
    ##################################################

    shopt -s nullglob
    backups=("${config_file}".linuxflow.*.bak)
    shopt -u nullglob

    if [ "${#backups[@]}" -eq 0 ]; then
        warning "No LinuxFlow SSH configuration backups found."
        pause
        return
    fi

    echo "Available Backups:"
    echo "----------------------------------------"

    count=1

    for backup in "${backups[@]}"
    do
        echo "$count. $(basename "$backup")"
        ((count++))
    done

    echo
    read -p "Enter backup number: " choice

    ##################################################
    # Validate selection
    ##################################################

    if [[ ! "$choice" =~ ^[0-9]+$ ]]; then
        error "Invalid backup number."
        pause
        return
    fi

    if [ "$choice" -lt 1 ] ||
       [ "$choice" -gt "${#backups[@]}" ]; then

        error "Backup number is out of range."
        pause
        return
    fi

    selected_backup="${backups[$((choice - 1))]}"

    ##################################################
    # Validate backup BEFORE restoring
    ##################################################

    echo
    echo "Validating selected backup..."

    if ! sshd -t -f "$selected_backup"; then

        error "Selected backup contains an invalid SSH configuration."
        warning "Restore operation cancelled."

        pause
        return
    fi

    success "Backup configuration is valid."

    echo
    echo "Selected Backup : $(basename "$selected_backup")"
    echo

    warning "Restoring this backup will replace the current SSH configuration."
    warning "SSH settings such as port and authentication may change."
    echo

    read -p "Type RESTORE to continue: " confirm

    if [ "$confirm" != "RESTORE" ]; then
        warning "Operation cancelled."
        pause
        return
    fi

    ##################################################
    # Backup CURRENT configuration
    ##################################################

    timestamp=$(date +"%Y%m%d_%H%M%S")
    safety_backup="${config_file}.linuxflow.before_restore.${timestamp}.bak"

    if ! cp -a "$config_file" "$safety_backup"; then
        error "Failed to backup current SSH configuration."
        pause
        return
    fi

    success "Current configuration backed up."
    echo "Safety Backup : $safety_backup"

    ##################################################
    # Restore selected configuration
    ##################################################

    if ! cp -a "$selected_backup" "$config_file"; then

        error "Failed to restore SSH configuration."

        cp -a "$safety_backup" "$config_file"

        pause
        return
    fi

    ##################################################
    # Validate restored configuration
    ##################################################

    if ! sshd -t; then

        error "Restored SSH configuration failed validation."
        warning "Rolling back..."

        if cp -a "$safety_backup" "$config_file"; then
            success "Previous configuration restored."
        else
            error "CRITICAL: Failed to restore previous configuration."
        fi

        pause
        return
    fi

    ##################################################
    # Restart SSH
    ##################################################

    echo
    echo "Applying restored configuration..."

    if ! systemctl restart "$ssh_service"; then

        error "SSH failed to restart."
        warning "Rolling back..."

        cp -a "$safety_backup" "$config_file"
        systemctl restart "$ssh_service" 2>/dev/null

        warning "Previous configuration restored."

        pause
        return
    fi

    ##################################################
    # Verify service
    ##################################################

    if ! systemctl is-active --quiet "$ssh_service"; then

        error "SSH service is not active after restore."
        warning "Rolling back..."

        cp -a "$safety_backup" "$config_file"
        systemctl restart "$ssh_service" 2>/dev/null

        pause
        return
    fi

    success "SSH configuration restored successfully."

    ##################################################
    # Show restored effective settings
    ##################################################

    restored_config=$(sshd -T 2>/dev/null)

    restored_port=$(echo "$restored_config" |
        awk '$1=="port" {print $2; exit}')

    restored_root=$(echo "$restored_config" |
        awk '$1=="permitrootlogin" {print $2; exit}')

    restored_password=$(echo "$restored_config" |
        awk '$1=="passwordauthentication" {print $2; exit}')

    restored_pubkey=$(echo "$restored_config" |
        awk '$1=="pubkeyauthentication" {print $2; exit}')

    echo
    echo "========== Restored Configuration =========="
    echo

    echo "SSH Port              : $restored_port"
    echo "Root Login            : $restored_root"
    echo "Password Auth         : $restored_password"
    echo "Public Key Auth       : $restored_pubkey"

    echo
    warning "If the SSH port changed, verify the firewall configuration."
    warning "Keep the current session open until a new SSH connection succeeds."

    pause
}


##################################################
# Function : ssh_security_check
# Purpose  : Perform SSH security and health check
##################################################

ssh_security_check() {

    header

    echo "========== SSH Security & Health Check =========="
    echo

    if ! check_ssh_installed; then
        pause
        return
    fi

    ssh_service=$(get_ssh_service)

    if [ -z "$ssh_service" ]; then
        error "Unable to detect SSH service."
        pause
        return
    fi

    config_file="/etc/ssh/sshd_config"

    echo "Checking SSH configuration..."
    echo

    ##################################################
    # Configuration validation
    ##################################################

    if sshd -t 2>/dev/null; then
        config_status="Valid"
    else
        config_status="INVALID"
    fi

    ##################################################
    # Service status
    ##################################################

    if systemctl is-active --quiet "$ssh_service"; then
        service_status="Active"
    else
        service_status="Inactive"
    fi

    if systemctl is-enabled --quiet "$ssh_service" 2>/dev/null; then
        enabled_status="Enabled"
    else
        enabled_status="Disabled"
    fi

    ##################################################
    # Read effective configuration
    ##################################################

    config=$(sshd -T 2>/dev/null)

    if [ -z "$config" ]; then
        error "Unable to read effective SSH configuration."
        pause
        return
    fi

    ssh_port=$(echo "$config" |
        awk '$1=="port" {print $2; exit}')

    root_login=$(echo "$config" |
        awk '$1=="permitrootlogin" {print $2; exit}')

    password_auth=$(echo "$config" |
        awk '$1=="passwordauthentication" {print $2; exit}')

    pubkey_auth=$(echo "$config" |
        awk '$1=="pubkeyauthentication" {print $2; exit}')

    empty_passwords=$(echo "$config" |
        awk '$1=="permitemptypasswords" {print $2; exit}')

    max_auth_tries=$(echo "$config" |
        awk '$1=="maxauthtries" {print $2; exit}')

    x11_forwarding=$(echo "$config" |
        awk '$1=="x11forwarding" {print $2; exit}')

    tcp_forwarding=$(echo "$config" |
        awk '$1=="allowtcpforwarding" {print $2; exit}')

    ##################################################
    # Check listening port
    ##################################################

    if ss -ltnH 2>/dev/null |
        awk '{print $4}' |
        grep -Eq "[:.]${ssh_port}$"; then

        listening_status="Yes"
    else
        listening_status="No"
    fi

    ##################################################
    # Firewall status
    ##################################################

    firewall_status="Not Active"
    firewall_rule="Not Checked"

    if systemctl is-active --quiet firewalld &&
       command -v firewall-cmd &>/dev/null; then

        firewall_status="Active"

        zone=$(get_firewall_zone 2>/dev/null)

        if [ -n "$zone" ]; then

            # Port may be allowed directly
            if firewall-cmd \
                --zone="$zone" \
                --query-port="${ssh_port}/tcp" &>/dev/null; then

                firewall_rule="Allowed (${ssh_port}/tcp)"

            # Or through predefined ssh service
            elif firewall-cmd \
                --zone="$zone" \
                --query-service=ssh &>/dev/null; then

                firewall_rule="Allowed (ssh service)"

            else
                firewall_rule="NOT ALLOWED"
            fi

        else
            firewall_rule="Zone Detection Failed"
        fi
    fi

    ##################################################
    # SELinux status
    ##################################################

    if command -v getenforce &>/dev/null; then
        selinux_status=$(getenforce)
    else
        selinux_status="Not Available"
    fi

    ##################################################
    # Display report
    ##################################################

    echo "=============================================="
    echo "             SSH HEALTH REPORT"
    echo "=============================================="
    echo

    echo "SSH Service          : $ssh_service"
    echo "Service Status       : $service_status"
    echo "Boot Status          : $enabled_status"
    echo "Config Validation    : $config_status"
    echo

    echo "SSH Port             : $ssh_port"
    echo "Listening            : $listening_status"
    echo

    echo "Root Login           : $root_login"
    echo "Password Auth        : $password_auth"
    echo "Public Key Auth      : $pubkey_auth"
    echo "Empty Passwords      : $empty_passwords"
    echo "Max Auth Tries       : $max_auth_tries"
    echo "X11 Forwarding       : $x11_forwarding"
    echo "TCP Forwarding       : $tcp_forwarding"
    echo

    echo "Firewall Status      : $firewall_status"
    echo "Firewall Rule        : $firewall_rule"
    echo "SELinux Status       : $selinux_status"

    echo
    echo "=============================================="
    echo "              SECURITY WARNINGS"
    echo "=============================================="
    echo

    warning_count=0

    ##################################################
    # Security checks
    ##################################################

    if [ "$config_status" != "Valid" ]; then
        warning "SSH configuration contains errors."
        ((warning_count++))
    fi

    if [ "$service_status" != "Active" ]; then
        warning "SSH service is not running."
        ((warning_count++))
    fi

    if [ "$enabled_status" != "Enabled" ]; then
        warning "SSH service is not enabled at boot."
        ((warning_count++))
    fi

    if [ "$listening_status" != "Yes" ]; then
        warning "SSH is not listening on configured port $ssh_port."
        ((warning_count++))
    fi

    if [ "$root_login" = "yes" ]; then
        warning "Direct root SSH login is enabled."
        ((warning_count++))
    fi

    if [ "$password_auth" = "yes" ]; then
        warning "Password authentication is enabled."
        ((warning_count++))
    fi

    if [ "$pubkey_auth" != "yes" ]; then
        warning "Public key authentication is disabled."
        ((warning_count++))
    fi

    if [ "$empty_passwords" = "yes" ]; then
        warning "SSH permits empty passwords."
        ((warning_count++))
    fi

    if [[ "$max_auth_tries" =~ ^[0-9]+$ ]] &&
       [ "$max_auth_tries" -gt 6 ]; then

        warning "MaxAuthTries is relatively high ($max_auth_tries)."
        ((warning_count++))
    fi

    if [ "$firewall_status" = "Active" ] &&
       [ "$firewall_rule" = "NOT ALLOWED" ]; then

        warning "SSH port is not allowed through the active firewall zone."
        ((warning_count++))
    fi

    echo
    echo "----------------------------------------------"

    if [ "$warning_count" -eq 0 ]; then
        success "No major SSH configuration issues detected."
    else
        warning "Total Warnings : $warning_count"
    fi

    echo "----------------------------------------------"

    pause
}



##################################################
# Function : ssh_menu
# Purpose  : Display SSH Management Menu
##################################################

ssh_menu() {

    while true
    do

        header

        echo "========== SSH Management =========="
        echo
        echo "1. SSH Status"
        echo "2. SSH Configuration"
        echo "3. Active SSH Connections"
        echo "4. Change SSH Port"
        echo "5. Manage Root SSH Login"
        echo "6. Manage Password Authentication"
        echo "7. Manage Public Key Authentication"
        echo "8. List SSH Configuration Backups"
        echo "9. Restore SSH Configuration"
        echo "10. SSH Security & Health Check"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                ssh_status
                ;;

            2)
                ssh_configuration
                ;;

            3)
                list_ssh_connections
                ;;

            4)
                change_ssh_port
                ;;
            
            5)
                manage_root_login
                ;;

            6)
                manage_password_auth
                ;;  

            
            
            7)
                manage_public_key_auth
                ;;

            8)
                list_ssh_backups
                ;;

            9)
                restore_ssh_backup
                ;;

            10)
                ssh_security_check
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



