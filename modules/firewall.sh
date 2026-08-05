#!/bin/bash

############################################
# Firewall Management Module
############################################


##################################################
# Function : check_firewall_ready
# Purpose  : Verify firewalld is installed/running
##################################################

check_firewall_ready() {

    if ! command -v firewall-cmd &>/dev/null; then
        error "Firewalld is not installed."
        return 1
    fi

    if ! systemctl is-active --quiet firewalld; then
        error "Firewall is not running."
        return 1
    fi

    return 0
}


##################################################
# Function : get_firewall_zone
# Purpose  : Determine firewall zone to manage
##################################################

get_firewall_zone() {

    local zone

    # Try zone of default route interface first
    local interface

    interface=$(ip route show default 2>/dev/null |
        awk 'NR==1 {print $5}')

    if [ -n "$interface" ]; then

        zone=$(firewall-cmd \
            --get-zone-of-interface="$interface" \
            2>/dev/null)

    fi

    # Fallback to default zone
    if [ -z "$zone" ] || [ "$zone" = "no zone" ]; then
        zone=$(firewall-cmd --get-default-zone 2>/dev/null)
    fi

    if [ -z "$zone" ]; then
        error "Unable to determine firewall zone."
        return 1
    fi

    echo "$zone"
}



##################################################
# Function : get_ssh_port
# Purpose  : Detect configured SSH port
##################################################

get_ssh_port() {

    local ssh_port

    if command -v sshd &>/dev/null; then

        ssh_port=$(sshd -T 2>/dev/null |
            awk '$1 == "port" {print $2; exit}')

    fi

    echo "${ssh_port:-22}"
}




##################################################
# Function : firewall_status
# Purpose  : Display current firewall status
##################################################

firewall_status() {

    header

    echo "========== Firewall Status =========="
    echo

    # Check if firewalld is installed
    if ! command -v firewall-cmd &>/dev/null; then
        error "Firewalld is not installed."
        pause
        return
    fi

    echo "Service Status : $(systemctl is-active firewalld)"
    echo "Boot Status    : $(systemctl is-enabled firewalld 2>/dev/null)"

    echo

    # Check if firewall is running
    if ! systemctl is-active --quiet firewalld; then
        warning "Firewall is currently not running."
        pause
        return
    fi

    echo "Firewall State : $(firewall-cmd --state)"

    echo
    echo "Active Zones:"
    echo "----------------------------------------"

    firewall-cmd --get-active-zones

    pause
}


##################################################
# Function : list_firewall_rules
# Purpose  : Display firewall rules
##################################################

list_firewall_rules() {

    header

    echo "========== Firewall Rules =========="
    echo

    if ! check_firewall_ready; then
        pause
        return
    fi

    zone=$(get_firewall_zone)

    if [ -z "$zone" ]; then
        pause
        return
    fi

    echo "Active Zone : $zone"
    echo
    echo "========== Active Firewall Rules =========="
    echo

    firewall-cmd --zone="$zone" --list-all

    pause
}



##################################################
# Function : validate_port
# Purpose  : Validate network port number
##################################################

validate_port() {

    local port="$1"

    # Must contain numbers only
    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        error "Invalid port number."
        return 1
    fi

    # Valid TCP/UDP port range
    if (( port < 1 || port > 65535 )); then
        error "Port must be between 1 and 65535."
        return 1
    fi

    return 0
}


##################################################
# Function : allow_port
# Purpose  : Allow port through firewall
##################################################

allow_port() {

    header

    echo "========== Allow Firewall Port =========="
    echo

    if ! check_firewall_ready; then
        pause
        return
    fi

    zone=$(get_firewall_zone)

    if [ -z "$zone" ]; then
        pause
        return
    fi

    echo "Firewall Zone : $zone"
    echo

    read -p "Enter port number: " port

    if ! validate_port "$port"; then
        pause
        return
    fi

    echo
    read -p "Enter protocol (tcp/udp): " protocol

    protocol=$(echo "$protocol" | tr '[:upper:]' '[:lower:]')

    case "$protocol" in
        tcp|udp)
            ;;
        *)
            error "Protocol must be tcp or udp."
            pause
            return
            ;;
    esac

    ##################################################
    # Check duplicate rule
    ##################################################

    if firewall-cmd \
        --permanent \
        --zone="$zone" \
        --query-port="${port}/${protocol}" &>/dev/null; then

        warning "Port ${port}/${protocol} is already allowed in zone '$zone'."
        pause
        return
    fi

    echo
    echo "Zone     : $zone"
    echo "Port     : $port"
    echo "Protocol : $protocol"
    echo

    read -p "Allow this port? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            ##################################################
            # Add permanent firewall rule
            ##################################################

            if firewall-cmd \
                --permanent \
                --zone="$zone" \
                --add-port="${port}/${protocol}" \
                >/dev/null 2>&1; then

                ##################################################
                # Reload firewall
                ##################################################

                if firewall-cmd --reload >/dev/null 2>&1; then

                    success "Port ${port}/${protocol} allowed successfully in zone '$zone'."

                else

                    error "Firewall reload failed."
                    warning "Rolling back firewall change..."

                    ##################################################
                    # Rollback added rule
                    ##################################################

                    if firewall-cmd \
                        --permanent \
                        --zone="$zone" \
                        --remove-port="${port}/${protocol}" \
                        >/dev/null 2>&1; then

                        firewall-cmd --reload >/dev/null 2>&1

                        warning "Firewall rule rolled back."

                    else

                        error "Failed to rollback firewall rule."

                    fi
                fi

            else

                error "Failed to allow port."

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
# Function : remove_port
# Purpose  : Safely remove allowed firewall port
##################################################

remove_port() {

    header

    echo "========== Remove Firewall Port =========="
    echo

    if ! check_firewall_ready; then
        pause
        return
    fi

    zone=$(get_firewall_zone)

    if [ -z "$zone" ]; then
        pause
        return
    fi

    echo "Firewall Zone : $zone"
    echo

    read -p "Enter port number: " port

    if ! validate_port "$port"; then
        pause
        return
    fi

    echo
    read -p "Enter protocol (tcp/udp): " protocol

    protocol=$(echo "$protocol" | tr '[:upper:]' '[:lower:]')

    case "$protocol" in
        tcp|udp)
            ;;
        *)
            error "Protocol must be tcp or udp."
            pause
            return
            ;;
    esac

    ##################################################
    # Check whether rule exists
    ##################################################

    if ! firewall-cmd \
        --permanent \
        --zone="$zone" \
        --query-port="${port}/${protocol}" &>/dev/null; then

        warning "Port ${port}/${protocol} is not currently allowed in zone '$zone'."
        pause
        return
    fi

    ##################################################
    # SSH protection
    ##################################################

    ssh_port=$(get_ssh_port)

    if [ "$protocol" = "tcp" ] &&
       [ "$port" = "$ssh_port" ]; then

        echo
        warning "Port $port is currently configured as the SSH port."
        warning "Removing it may block remote SSH access."
        echo

        read -p "Type YES to continue: " ssh_confirm

        if [ "$ssh_confirm" != "YES" ]; then

            warning "Operation cancelled."
            pause
            return
        fi
    fi

    echo
    echo "Zone     : $zone"
    echo "Port     : $port"
    echo "Protocol : $protocol"
    echo

    read -p "Remove this firewall port? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            ##################################################
            # Remove permanent rule
            ##################################################

            if firewall-cmd \
                --permanent \
                --zone="$zone" \
                --remove-port="${port}/${protocol}" \
                >/dev/null 2>&1; then

                ##################################################
                # Reload firewall
                ##################################################

                if firewall-cmd --reload >/dev/null 2>&1; then

                    success "Port ${port}/${protocol} removed successfully."

                else

                    error "Firewall reload failed."
                    warning "Restoring removed firewall rule..."

                    ##################################################
                    # Rollback removed rule
                    ##################################################

                    if firewall-cmd \
                        --permanent \
                        --zone="$zone" \
                        --add-port="${port}/${protocol}" \
                        >/dev/null 2>&1; then

                        firewall-cmd --reload >/dev/null 2>&1

                        warning "Firewall rule restored."

                    else

                        error "Failed to restore firewall rule."

                    fi
                fi

            else

                error "Failed to remove port."

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
# Function : validate_firewall_service
# Purpose  : Validate predefined firewall service
##################################################

validate_firewall_service() {

    local service="$1"

    # Empty check
    if [ -z "$service" ]; then
        error "Service name cannot be empty."
        return 1
    fi

    # Check whether firewalld knows this service
    if ! firewall-cmd --get-services | tr ' ' '\n' | grep -Fxq "$service"; then
        error "Firewall service '$service' does not exist."
        return 1
    fi

    return 0
}


##################################################
# Function : allow_service
# Purpose  : Allow predefined firewall service
##################################################

allow_service() {

    header

    echo "========== Allow Firewall Service =========="
    echo

    if ! check_firewall_ready; then
        pause
        return
    fi

    zone=$(get_firewall_zone)

    if [ -z "$zone" ]; then
        pause
        return
    fi

    echo "Firewall Zone : $zone"
    echo

    read -p "Enter service name: " service

    if ! validate_firewall_service "$service"; then
        pause
        return
    fi

    ##################################################
    # Check duplicate service
    ##################################################

    if firewall-cmd \
        --permanent \
        --zone="$zone" \
        --query-service="$service" &>/dev/null; then

        warning "Service '$service' is already allowed in zone '$zone'."
        pause
        return
    fi

    echo
    read -p "Allow firewall service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            ##################################################
            # Add permanent service
            ##################################################

            if firewall-cmd \
                --permanent \
                --zone="$zone" \
                --add-service="$service" \
                >/dev/null 2>&1; then

                ##################################################
                # Reload firewall
                ##################################################

                if firewall-cmd --reload >/dev/null 2>&1; then

                    success "Service '$service' allowed successfully in zone '$zone'."

                else

                    error "Firewall reload failed."
                    warning "Rolling back firewall service change..."

                    ##################################################
                    # Rollback added service
                    ##################################################

                    if firewall-cmd \
                        --permanent \
                        --zone="$zone" \
                        --remove-service="$service" \
                        >/dev/null 2>&1; then

                        firewall-cmd --reload >/dev/null 2>&1

                        warning "Firewall service rollback completed."

                    else

                        error "Failed to rollback firewall service."

                    fi
                fi

            else

                error "Failed to allow service '$service'."

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
# Function : remove_service
# Purpose  : Safely remove firewall service
##################################################

remove_service() {

    header

    echo "========== Remove Firewall Service =========="
    echo

    if ! check_firewall_ready; then
        pause
        return
    fi

    zone=$(get_firewall_zone)

    if [ -z "$zone" ]; then
        pause
        return
    fi

    echo "Firewall Zone : $zone"
    echo

    read -p "Enter service name: " service

    if ! validate_firewall_service "$service"; then
        pause
        return
    fi

    ##################################################
    # Check whether service is allowed
    ##################################################

    if ! firewall-cmd \
        --permanent \
        --zone="$zone" \
        --query-service="$service" &>/dev/null; then

        warning "Service '$service' is not currently allowed in zone '$zone'."
        pause
        return
    fi

    ##################################################
    # SSH protection
    ##################################################

    if [ "$service" = "ssh" ]; then

        echo
        warning "Removing the SSH firewall service may block remote access."
        echo

        read -p "Type YES to continue: " ssh_confirm

        if [ "$ssh_confirm" != "YES" ]; then

            warning "Operation cancelled."
            pause
            return
        fi
    fi

    echo
    read -p "Remove firewall service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            ##################################################
            # Remove permanent service
            ##################################################

            if firewall-cmd \
                --permanent \
                --zone="$zone" \
                --remove-service="$service" \
                >/dev/null 2>&1; then

                ##################################################
                # Reload firewall
                ##################################################

                if firewall-cmd --reload >/dev/null 2>&1; then

                    success "Service '$service' removed successfully."

                else

                    error "Firewall reload failed."
                    warning "Restoring removed firewall service..."

                    ##################################################
                    # Rollback removed service
                    ##################################################

                    if firewall-cmd \
                        --permanent \
                        --zone="$zone" \
                        --add-service="$service" \
                        >/dev/null 2>&1; then

                        firewall-cmd --reload >/dev/null 2>&1

                        warning "Firewall service restored."

                    else

                        error "Failed to restore firewall service."

                    fi
                fi

            else

                error "Failed to remove service '$service'."

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
# Function : reload_firewall
# Purpose  : Reload firewall configuration
##################################################

reload_firewall() {

    header

    echo "========== Reload Firewall =========="
    echo

    # Check firewalld installation
    if ! command -v firewall-cmd &>/dev/null; then
        error "Firewalld is not installed."
        pause
        return
    fi

    # Check firewall state
    if ! systemctl is-active --quiet firewalld; then
        error "Firewall is not running."
        pause
        return
    fi

    read -p "Reload firewall configuration? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if firewall-cmd --reload >/dev/null; then
                success "Firewall reloaded successfully."
            else
                error "Failed to reload firewall."
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
# Function : firewall_menu
# Purpose  : Displays Firewall Management Menu
##################################################

firewall_menu() {

    while true
    do

        header

        echo "========== Firewall Management =========="
        echo
        echo "1. Firewall Status"
        echo "2. List Firewall Rules"
        echo "3. Allow Port"
        echo "4. Remove Port"
        echo "5. Allow Service"
        echo "6. Remove Service"
        echo "7. Reload Firewall"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

         case "$choice" in

            1)
                firewall_status
                ;;

            2)
                list_firewall_rules
                ;;

            3)
                allow_port
                ;;

            4)
                remove_port
                ;;

            5)
                allow_service
                ;;

            6)
                remove_service
                ;;

            7)
                reload_firewall
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