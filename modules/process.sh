#!/bin/bash


##################################################
# Function : validate_pid
# Purpose  : Validate process ID
##################################################

validate_pid() {

    local pid="$1"

    if [ -z "$pid" ]; then
        error "PID cannot be empty."
        return 1
    fi

    if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
        error "Invalid PID. Enter a numeric process ID."
        return 1
    fi

    if [ "$pid" -le 0 ]; then
        error "Invalid PID."
        return 1
    fi

    if ! ps -p "$pid" &>/dev/null; then
        error "Process with PID '$pid' not found."
        return 1
    fi

    return 0
}


##################################################
# Function : protect_critical_process
# Purpose  : Protect critical/system processes
##################################################

protect_critical_process() {

    local pid="$1"
    local process_name
    local process_user

    ##################################################
    # Protect systemd/init
    ##################################################

    if [ "$pid" -eq 1 ]; then
        error "PID 1 is the system initialization process."
        warning "Terminating it could make the system unstable."
        return 1
    fi

    ##################################################
    # Protect LinuxFlow itself
    ##################################################

    if [ "$pid" -eq "$$" ]; then
        error "LinuxFlow cannot terminate its own process."
        return 1
    fi

    ##################################################
    # Protect parent shell/process
    ##################################################

    if [ "$pid" -eq "$PPID" ]; then
        error "LinuxFlow cannot terminate its parent process."
        return 1
    fi

    process_name=$(ps -p "$pid" -o comm= 2>/dev/null)
    process_user=$(ps -p "$pid" -o user= 2>/dev/null | xargs)

    ##################################################
    # Protect important processes
    ##################################################

    case "$process_name" in

        systemd|init|systemd-journald|systemd-logind|dbus-daemon|NetworkManager|sshd)

            error "'$process_name' is a critical system process."
            warning "Use the Service Manager for managing system services."
            return 1
            ;;

    esac

    return 0
}



##################################################
# Function : list_processes
# Purpose  : Display all running processes
##################################################

list_processes() {

    header

    echo "========== Running Processes =========="
    echo

    ps -ef | less -S

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

    if [ -z "$process" ]; then
        error "Process name cannot be empty."
        pause
        return
    fi

    echo

    pids=$(pgrep -x -- "$process" 2>/dev/null)

    if [ -z "$pids" ]; then
        warning "No exact process found with name '$process'."
        pause
        return
    fi

    echo "Matching Processes:"
    echo

    printf "%-10s %-15s %-10s %-10s %s\n" \
        "PID" "USER" "%CPU" "%MEM" "COMMAND"

    printf "%-10s %-15s %-10s %-10s %s\n" \
        "----------" "---------------" "----------" "----------" "--------------------"

    for pid in $pids
    do
        ps -p "$pid" \
            -o pid=,user=,%cpu=,%mem=,comm=
    done

    pause
}


##################################################
# Function : kill_process
# Purpose  : Safely terminate a running process
##################################################

kill_process() {

    header

    echo "========== Kill Process =========="
    echo

    read -p "Enter Process ID (PID): " pid

    if ! validate_pid "$pid"; then
        pause
        return
    fi

    if ! protect_critical_process "$pid"; then
        pause
        return
    fi

    echo
    echo "Process Details:"
    echo "----------------------------------------"

    ps -p "$pid" \
        -o pid,user,ppid,%cpu,%mem,etime,cmd

    echo
    warning "A termination signal (SIGTERM) will be sent."
    echo

    read -p "Terminate process PID '$pid'? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            if kill -TERM "$pid" 2>/dev/null; then

                # Give process a moment to terminate
                sleep 1

                if ! ps -p "$pid" &>/dev/null; then

                    success "Process terminated successfully."

                else

                    warning "Process did not terminate after SIGTERM."
                    echo
                    warning "Force Kill (SIGKILL) may cause data loss."
                    echo

                    read -p "Force kill process? Type YES to continue: " force_confirm

                    if [ "$force_confirm" = "YES" ]; then

                        if kill -KILL "$pid" 2>/dev/null; then

                            sleep 1

                            if ! ps -p "$pid" &>/dev/null; then
                                success "Process forcefully terminated."
                            else
                                error "Process could not be terminated."
                            fi

                        else
                            error "Failed to force kill process."
                        fi

                    else
                        warning "Force kill cancelled."
                    fi
                fi

            else
                error "Failed to send termination signal."
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
# Purpose  : Display detailed process information
##################################################

process_information() {

    header

    echo "========== Process Information =========="
    echo

    read -p "Enter Process ID (PID): " pid

    if ! validate_pid "$pid"; then
        pause
        return
    fi

    echo
    echo "========== Process Details =========="
    echo

    ps -p "$pid" \
        -o pid,user,ppid,state,lstart,etime,cmd

    echo
    echo "========== Resource Usage =========="
    echo

    ps -p "$pid" \
        -o %cpu,%mem,vsz,rss

    echo

    if [ -r "/proc/$pid/exe" ]; then
        executable=$(readlink -f "/proc/$pid/exe" 2>/dev/null)
        echo "Executable : ${executable:-Unknown}"
    fi

    if [ -r "/proc/$pid/cwd" ]; then
        working_dir=$(readlink -f "/proc/$pid/cwd" 2>/dev/null)
        echo "Working Dir: ${working_dir:-Unknown}"
    fi

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