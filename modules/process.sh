##################################################
# Function : list_processes
# Purpose  : Display all running processes
##################################################

list_processes() {

    header

    echo "========== Running Processes =========="
    echo

    ps -ef | less

    echo
    echo "----------------------------------------"

    total=$(ps -e --no-headers | wc -l)

    echo "Total Running Processes : $total"

    pause
}



##################################################
# Function : search_process
# Purpose  : Search process by name
##################################################

search_process() {

    header

    echo "========== Search Process =========="
    echo

    read -p "Enter process name: " process

    echo

    pids=$(pgrep "$process")

    if [ -z "$pids" ]; then
        error "No process found with name '$process'."
        pause
        return
    fi

    echo "Matching Processes:"
    echo

    for pid in $pids
    do
        ps -fp "$pid"
    done

    pause
}



##################################################
# Function : kill_process
# Purpose  : Terminate a running process
##################################################

kill_process() {

    header

    echo "========== Kill Process =========="
    echo

    read -p "Enter Process ID (PID): " pid

    if ! ps -p "$pid" > /dev/null 2>&1; then
        error "Process with PID '$pid' not found."
        pause
        return
    fi

    echo
    echo "Process Details:"
    ps -fp "$pid"

    echo

    read -p "Do you want to terminate this process? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if kill "$pid"; then
                success "Process terminated successfully."
            else
                error "Failed to terminate process."
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
# Function : process_information
# Purpose  : Display process information
##################################################

process_information() {

    header

    echo "========== Process Information =========="
    echo

    read -p "Enter Process ID (PID): " pid

    if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
        error "Invalid PID."
        pause
        return
    fi

    if ! ps -p "$pid" > /dev/null 2>&1; then
        error "Process with PID '$pid' not found."
        pause
        return
    fi

    echo
    echo "========== Process Details =========="
    echo

    ps -fp "$pid"

    echo
    echo "========== Resource Usage =========="
    echo

    ps -p "$pid" -o %cpu,%mem,etime,cmd

    pause
}



##################################################
# Function : system_resource_usage
# Purpose  : Display system resource information
##################################################

system_resource_usage() {

    header

    echo "========== System Resource Usage =========="
    echo

    echo "========== Memory Usage =========="
    free -h

    echo
    echo "========== Disk Usage =========="
    df -h

    echo
    echo "========== System Uptime =========="
    uptime

    echo
    echo "========== Logged In Users =========="
    who

    pause
}




##################################################
# Process Management Menu
##################################################

process_menu() {

    while true
    do

        header

        echo "========== Process Management =========="
        echo
        echo "1. List Running Processes"
        echo "2. Search Process"
        echo "3. Kill Process"
        echo "4. Process Information"
        echo "5. System Resource Usage"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                list_processes
                ;;

            2)
                search_process
                ;;

            3)
                kill_process
                ;;

            4)
                process_information
                ;;

            5)
                system_resource_usage
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