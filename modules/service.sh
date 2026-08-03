#!/bin/bash

##################################################
# Function : validate_service
# Purpose  : Validate systemd service
##################################################

validate_service() {

    local service="$1"

    if [ -z "$service" ]; then
        error "Service name cannot be empty."
        return 1
    fi

    # Allow user to enter sshd or sshd.service
    service="${service%.service}"

    # Basic safe service-name validation
    if [[ ! "$service" =~ ^[a-zA-Z0-9_.@-]+$ ]]; then
        error "Invalid service name."
        return 1
    fi

    if ! systemctl cat "${service}.service" &>/dev/null; then
        error "Service '$service' does not exist."
        return 1
    fi

    return 0
}



##################################################
# Function : is_critical_service
# Purpose  : Identify critical system services
##################################################

is_critical_service() {

    local service="${1%.service}"

    case "$service" in

        NetworkManager|sshd|dbus|systemd-logind|firewalld)

            return 0
            ;;

        *)

            return 1
            ;;

    esac
}





##################################################
# Function : list_services
# Purpose  : Display running services
##################################################

list_services() {

    header

    echo "========== Running Services =========="
    echo

   systemctl list-units \
    --type=service \
    --state=running \
    --no-pager

    echo

    total=$(systemctl list-units \
        --type=service \
        --state=running \
        --no-legend | wc -l)

    echo "---------------------------------------"
    echo "Running Services : $total"

    pause
}

##################################################
# Function : service_status
# Purpose  : Display service status
##################################################

service_status() {

    header

    echo "========== Service Status =========="
    echo

    read -p "Enter service name: " service

    service="${service%.service}"

    if ! validate_service "$service"; then
        pause
        return
    fi

    active_status=$(systemctl is-active "${service}.service" 2>/dev/null)
    enabled_status=$(systemctl is-enabled "${service}.service" 2>/dev/null)

    echo
    echo "========== Service Information =========="
    echo

    echo "Service Name   : $service"
    echo "Active Status  : ${active_status:-unknown}"
    echo "Enabled Status : ${enabled_status:-unknown}"

    echo
    echo "------------------------------------------"

    systemctl status "${service}.service" --no-pager

    pause
}


##################################################
# Function : start_service
# Purpose  : Start a system service
##################################################

start_service() {

    header

    echo "========== Start Service =========="
    echo

    read -p "Enter service name: " service

    service="${service%.service}"

    if ! validate_service "$service"; then
        pause
        return
    fi

    if systemctl is-active --quiet "${service}.service"; then
        warning "Service '$service' is already running."
        pause
        return
    fi

    echo
    read -p "Start service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl start "${service}.service"; then

                if systemctl is-active --quiet "${service}.service"; then
                    success "Service '$service' started successfully."
                else
                    error "Service command completed but service is not active."
                fi

            else
                error "Unable to start service '$service'."
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
# Function : stop_service
# Purpose  : Safely stop a system service
##################################################

stop_service() {

    header

    echo "========== Stop Service =========="
    echo

    read -p "Enter service name: " service

    service="${service%.service}"

    if ! validate_service "$service"; then
        pause
        return
    fi

    if ! systemctl is-active --quiet "${service}.service"; then
        warning "Service '$service' is already stopped."
        pause
        return
    fi

    ##################################################
    # Critical service warning
    ##################################################

    if is_critical_service "$service"; then

        echo
        warning "'$service' is a critical system service."
        warning "Stopping it may affect networking, remote access, or system operation."
        echo

        read -p "Continue with critical service? Type YES to continue: " critical_confirm

        if [ "$critical_confirm" != "YES" ]; then
            warning "Operation cancelled."
            pause
            return
        fi
    fi

    echo
    read -p "Stop service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl stop "${service}.service"; then

                if ! systemctl is-active --quiet "${service}.service"; then
                    success "Service '$service' stopped successfully."
                else
                    error "Service '$service' is still active."
                fi

            else
                error "Unable to stop service '$service'."
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
# Function : restart_service
# Purpose  : Safely restart a system service
##################################################

restart_service() {

    header

    echo "========== Restart Service =========="
    echo

    read -p "Enter service name: " service

    service="${service%.service}"

    if ! validate_service "$service"; then
        pause
        return
    fi

    if is_critical_service "$service"; then

        echo
        warning "'$service' is a critical system service."
        warning "Restarting it may temporarily affect system connectivity or access."
        echo

        read -p "Continue with critical service? Type YES to continue: " critical_confirm

        if [ "$critical_confirm" != "YES" ]; then
            warning "Operation cancelled."
            pause
            return
        fi
    fi

    echo
    read -p "Restart service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl restart "${service}.service"; then

                if systemctl is-active --quiet "${service}.service"; then
                    success "Service '$service' restarted successfully."
                else
                    error "Service restart completed but service is not active."
                fi

            else
                error "Unable to restart service '$service'."
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
# Function : enable_service
# Purpose  : Enable service at system boot
##################################################

enable_service() {

    header

    echo "========== Enable Service =========="
    echo

    read -p "Enter service name: " service

    service="${service%.service}"

    if ! validate_service "$service"; then
        pause
        return
    fi

    # Check if already enabled
    if systemctl is-enabled --quiet "${service}.service" 2>/dev/null; then
        warning "Service '$service' is already enabled."
        pause
        return
    fi

    echo
    echo "Service : $service"
    echo
    echo "Enabling this service will configure it to start automatically at boot."
    echo

    read -p "Enable service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl enable "${service}.service"; then

                if systemctl is-enabled --quiet "${service}.service"; then
                    success "Service '$service' enabled successfully."
                else
                    error "Service command completed but service is not enabled."
                fi

            else
                error "Failed to enable service '$service'."
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
# Function : disable_service
# Purpose  : Disable service from starting at boot
##################################################

disable_service() {

    header

    echo "========== Disable Service =========="
    echo

    read -p "Enter service name: " service

    service="${service%.service}"

    if ! validate_service "$service"; then
        pause
        return
    fi

    # Check current enable state
    if ! systemctl is-enabled --quiet "${service}.service" 2>/dev/null; then

        current_state=$(systemctl is-enabled "${service}.service" 2>/dev/null)

        warning "Service '$service' is not currently enabled."
        echo "Current State : ${current_state:-unknown}"

        pause
        return
    fi

    ##################################################
    # Critical service protection
    ##################################################

    if is_critical_service "$service"; then

        echo
        warning "'$service' is a critical system service."
        warning "Disabling it may prevent required functionality after reboot."
        echo

        read -p "Type YES to continue: " critical_confirm

        if [ "$critical_confirm" != "YES" ]; then
            warning "Operation cancelled."
            pause
            return
        fi
    fi

    echo
    echo "Service : $service"
    echo
    warning "This service will no longer start automatically at boot."
    echo

    read -p "Disable service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl disable "${service}.service"; then

                if ! systemctl is-enabled --quiet "${service}.service" 2>/dev/null; then
                    success "Service '$service' disabled successfully."
                else
                    error "Service is still enabled."
                fi

            else
                error "Failed to disable service '$service'."
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
# Service Management Menu
##################################################

service_menu() {

    while true
    do

        header

        echo "========== Service Management =========="
        echo
        echo "1. List Running Services"
        echo "2. Service Status"
        echo "3. Start Service"
        echo "4. Stop Service"
        echo "5. Restart Service"
        echo "6. Enable Service"
        echo "7. Disable Service"   
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                list_services
                ;;

            2)
                service_status
                ;;

            3)
                start_service
                ;;

            4)
                stop_service
                ;;

            5)
                restart_service
                ;;

            6)
                enable_service
                ;;
            
            7)
                disable_service
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