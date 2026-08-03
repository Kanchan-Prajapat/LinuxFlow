#!/bin/bash

############################################
# Firewall Management Module
############################################


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
# Purpose  : Display current firewall rules
##################################################

list_firewall_rules() {

    header

    echo "========== Firewall Rules =========="
    echo

    # Check if firewalld is installed
    if ! command -v firewall-cmd &>/dev/null; then
        error "Firewalld is not installed."
        pause
        return
    fi

    # Check if firewall is running
    if ! systemctl is-active --quiet firewalld; then
        error "Firewall is not running."
        pause
        return
    fi

    echo "Current Active Zone:"
    echo

    firewall-cmd --get-active-zones

    echo
    echo "========== Active Firewall Rules =========="
    echo

    firewall-cmd --list-all

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
# Purpose  : Allow a port through the firewall
##################################################

allow_port() {

    header

    echo "========== Allow Firewall Port =========="
    echo

    # Check firewalld
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

    read -p "Enter port number: " port

    if ! validate_port "$port"; then
        pause
        return
    fi

    echo
    read -p "Enter protocol (tcp/udp): " protocol

    case "$protocol" in
        tcp|udp)
            ;;
        *)
            error "Protocol must be tcp or udp."
            pause
            return
            ;;
    esac

    # Check whether port is already allowed
    if firewall-cmd --permanent \
        --query-port="${port}/${protocol}" &>/dev/null; then

        warning "Port ${port}/${protocol} is already allowed."
        pause
        return
    fi

    echo
    read -p "Allow port ${port}/${protocol}? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if firewall-cmd --permanent \
                --add-port="${port}/${protocol}" >/dev/null; then

                if firewall-cmd --reload >/dev/null; then
                    success "Port ${port}/${protocol} allowed successfully."
                else
                    error "Port was saved but firewall reload failed."
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
# Purpose  : Remove an allowed firewall port
##################################################

remove_port() {

    header

    echo "========== Remove Firewall Port =========="
    echo

    # Check firewalld
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

    read -p "Enter port number: " port

    if ! validate_port "$port"; then
        pause
        return
    fi

    echo
    read -p "Enter protocol (tcp/udp): " protocol

    case "$protocol" in

        tcp|udp)
            ;;

        *)
            error "Protocol must be tcp or udp."
            pause
            return
            ;;

    esac

    # Check whether port is currently allowed
    if ! firewall-cmd --permanent \
        --query-port="${port}/${protocol}" &>/dev/null; then

        warning "Port ${port}/${protocol} is not currently allowed."
        pause
        return
    fi

    echo
    read -p "Remove port ${port}/${protocol}? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if firewall-cmd --permanent \
                --remove-port="${port}/${protocol}" >/dev/null; then

                if firewall-cmd --reload >/dev/null; then
                    success "Port ${port}/${protocol} removed successfully."
                else
                    error "Port was removed from configuration but firewall reload failed."
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
# Purpose  : Allow a predefined firewall service
##################################################

allow_service() {

    header

    echo "========== Allow Firewall Service =========="
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

    read -p "Enter service name: " service

    if ! validate_firewall_service "$service"; then
        pause
        return
    fi

    # Check whether service is already allowed
    if firewall-cmd --permanent \
        --query-service="$service" &>/dev/null; then

        warning "Service '$service' is already allowed."
        pause
        return
    fi

    echo
    read -p "Allow firewall service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if firewall-cmd --permanent \
                --add-service="$service" >/dev/null; then

                if firewall-cmd --reload >/dev/null; then
                    success "Service '$service' allowed successfully."
                else
                    error "Service was added but firewall reload failed."
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
# Purpose  : Remove an allowed firewall service
##################################################

remove_service() {

    header

    echo "========== Remove Firewall Service =========="
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

    read -p "Enter service name: " service

    # Validate service
    if ! validate_firewall_service "$service"; then
        pause
        return
    fi

    # Check whether service is currently allowed
    if ! firewall-cmd --permanent \
        --query-service="$service" &>/dev/null; then

        warning "Service '$service' is not currently allowed."
        pause
        return
    fi

    echo
    read -p "Remove firewall service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if firewall-cmd --permanent \
                --remove-service="$service" >/dev/null; then

                if firewall-cmd --reload >/dev/null; then
                    success "Service '$service' removed successfully."
                else
                    error "Service was removed but firewall reload failed."
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
        echo "7. Enable Firewall"
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