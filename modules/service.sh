#!/bin/bash

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
        --state=running

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

    if ! systemctl list-unit-files | grep -q "^${service}.service"; then
        error "Service '$service' does not exist."
        pause
        return
    fi

    echo
    echo "========== Service Information =========="
    echo

    echo "Service Name : $service"

    echo "Active Status : $(systemctl is-active "$service")"

    echo "Enabled Status : $(systemctl is-enabled "$service" 2>/dev/null)"

    echo

    systemctl status "$service" --no-pager

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

    if ! systemctl list-unit-files | grep -q "^${service}.service"; then
        error "Service '$service' does not exist."
        pause
        return
    fi

    echo

    read -p "Start service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl start "$service"; then

                if [ "$(systemctl is-active "$service")" = "active" ]; then
                    success "Service started successfully."
                else
                    error "Service failed to start."
                fi

            else
                error "Unable to start service."
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
# Purpose  : Stop a system service
##################################################

stop_service() {

    header

    echo "========== Stop Service =========="
    echo

    read -p "Enter service name: " service

    if ! systemctl list-unit-files | grep -q "^${service}.service"; then
        error "Service '$service' does not exist."
        pause
        return
    fi

    if [ "$(systemctl is-active "$service")" != "active" ]; then
        warning "Service is already stopped."
        pause
        return
    fi

    echo

    read -p "Stop service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl stop "$service"; then

                if [ "$(systemctl is-active "$service")" != "active" ]; then
                    success "Service stopped successfully."
                else
                    error "Failed to stop service."
                fi

            else
                error "Unable to stop service."
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
# Purpose  : Restart a system service
##################################################

restart_service() {

    header

    echo "========== Restart Service =========="
    echo

    read -p "Enter service name: " service

    if ! systemctl list-unit-files | grep -q "^${service}.service"; then
        error "Service '$service' does not exist."
        pause
        return
    fi

    echo

    read -p "Restart service '$service'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if systemctl restart "$service"; then

                if [ "$(systemctl is-active "$service")" = "active" ]; then
                    success "Service restarted successfully."
                else
                    error "Service failed to restart."
                fi

            else
                error "Unable to restart service."
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
        echo "1. List Services"
        echo "2. Service Status"
        echo "3. Start Service"
        echo "4. Stop Service"
        echo "5. Restart Service"
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