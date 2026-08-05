#!/bin/bash

############################################
# System Monitoring Module
############################################


##################################################
# Function : cpu_usage
# Purpose  : Display current CPU utilization
##################################################

cpu_usage() {

    header

    echo "========== CPU Usage =========="
    echo

    ##################################################
    # CPU information
    ##################################################

    cpu_model=$(lscpu 2>/dev/null |
        awk -F: '/Model name/ {
            gsub(/^[ \t]+/, "", $2)
            print $2
            exit
        }')

    cpu_cores=$(nproc 2>/dev/null)

    echo "CPU Model : ${cpu_model:-Unknown}"
    echo "CPU Cores : ${cpu_cores:-Unknown}"

    echo
    echo "========== Current CPU Usage =========="
    echo

    ##################################################
    # Read CPU counters twice
    ##################################################

    read -r _ user nice system idle iowait irq softirq steal _ \
        < /proc/stat

    total1=$((user + nice + system + idle + iowait + irq + softirq + steal))
    idle1=$((idle + iowait))

    sleep 1

    read -r _ user nice system idle iowait irq softirq steal _ \
        < /proc/stat

    total2=$((user + nice + system + idle + iowait + irq + softirq + steal))
    idle2=$((idle + iowait))

    total_diff=$((total2 - total1))
    idle_diff=$((idle2 - idle1))

    if [ "$total_diff" -gt 0 ]; then

        cpu_percent=$(
            awk -v total="$total_diff" \
                -v idle="$idle_diff" \
                'BEGIN {
                    printf "%.2f", (total-idle)*100/total
                }'
        )

    else
        cpu_percent="0.00"
    fi

    echo "CPU Usage : ${cpu_percent}%"

    echo
    echo "========== Load Average =========="
    echo

    read -r load1 load5 load15 _ < /proc/loadavg

    echo "1 Minute  : $load1"
    echo "5 Minutes : $load5"
    echo "15 Minutes: $load15"

    pause
}



##################################################
# Function : memory_usage
# Purpose  : Display memory and swap utilization
##################################################

memory_usage() {

    header

    echo "========== Memory Usage =========="
    echo

    ##################################################
    # Read memory information
    ##################################################

    total_mem=$(free -b | awk '/^Mem:/ {print $2}')
    used_mem=$(free -b | awk '/^Mem:/ {print $3}')
    available_mem=$(free -b | awk '/^Mem:/ {print $7}')

    if [ -z "$total_mem" ] || [ "$total_mem" -eq 0 ]; then
        error "Unable to read memory information."
        pause
        return
    fi

    ##################################################
    # Calculate memory usage percentage
    ##################################################

    memory_percent=$(awk \
        -v used="$used_mem" \
        -v total="$total_mem" \
        'BEGIN {
            printf "%.2f", (used * 100) / total
        }')

    ##################################################
    # Human readable values
    ##################################################

    total_human=$(free -h | awk '/^Mem:/ {print $2}')
    used_human=$(free -h | awk '/^Mem:/ {print $3}')
    available_human=$(free -h | awk '/^Mem:/ {print $7}')

    echo "Total Memory     : $total_human"
    echo "Used Memory      : $used_human"
    echo "Available Memory : $available_human"
    echo "Memory Usage     : ${memory_percent}%"

    echo

    ##################################################
    # Memory status
    ##################################################

    memory_integer=${memory_percent%.*}

    if [ "$memory_integer" -ge 90 ]; then

        error "Memory usage is critically high."

    elif [ "$memory_integer" -ge 75 ]; then

        warning "Memory usage is high."

    else

        success "Memory usage is within normal range."

    fi


    ##################################################
    # Swap Usage
    ##################################################

    echo
    echo "========== Swap Usage =========="
    echo

    swap_total=$(free -b | awk '/^Swap:/ {print $2}')
    swap_used=$(free -b | awk '/^Swap:/ {print $3}')

    swap_total_human=$(free -h | awk '/^Swap:/ {print $2}')
    swap_used_human=$(free -h | awk '/^Swap:/ {print $3}')
    swap_free_human=$(free -h | awk '/^Swap:/ {print $4}')

    if [ -z "$swap_total" ] || [ "$swap_total" -eq 0 ]; then

        warning "No active swap space detected."

    else

        swap_percent=$(awk \
            -v used="$swap_used" \
            -v total="$swap_total" \
            'BEGIN {
                printf "%.2f", (used * 100) / total
            }')

        echo "Total Swap : $swap_total_human"
        echo "Used Swap  : $swap_used_human"
        echo "Free Swap  : $swap_free_human"
        echo "Swap Usage : ${swap_percent}%"

        echo

        swap_integer=${swap_percent%.*}

        if [ "$swap_integer" -ge 90 ]; then

            error "Swap usage is critically high."

        elif [ "$swap_integer" -ge 75 ]; then

            warning "Swap usage is high."

        else

            success "Swap usage is within normal range."

        fi

    fi

    echo
    echo "========== Memory Overview =========="
    echo

    free -h

    pause
}


##################################################
# Function : disk_usage
# Purpose  : Display filesystem disk utilization
##################################################

disk_usage() {

    header

    echo "========== Disk Usage =========="
    echo

    ##################################################
    # Display filesystem information
    ##################################################

    printf "%-20s %-10s %-10s %-10s %-8s %-20s\n" \
        "FILESYSTEM" "SIZE" "USED" "AVAIL" "USE%" "MOUNT POINT"

    printf "%-20s %-10s %-10s %-10s %-8s %-20s\n" \
        "--------------------" "----------" "----------" \
        "----------" "--------" "--------------------"

    df -hP -x tmpfs -x devtmpfs 2>/dev/null |
        awk 'NR > 1 {
            printf "%-20s %-10s %-10s %-10s %-8s %-20s\n",
            $1, $2, $3, $4, $5, $6
        }'

    echo


    ##################################################
    # Analyze disk usage
    ##################################################

    echo "========== Disk Health =========="
    echo

    warning_count=0
    critical_count=0

    while read -r filesystem size used avail percent mountpoint
    do

        usage=${percent%\%}

        # Skip invalid values
        if [[ ! "$usage" =~ ^[0-9]+$ ]]; then
            continue
        fi

        if [ "$usage" -ge 90 ]; then

            error "$mountpoint is critically full (${usage}%)."
            ((critical_count++))

        elif [ "$usage" -ge 80 ]; then

            warning "$mountpoint has high disk usage (${usage}%)."
            ((warning_count++))

        else

            success "$mountpoint usage is normal (${usage}%)."

        fi

    done < <(
        df -hP -x tmpfs -x devtmpfs 2>/dev/null |
        awk 'NR > 1 {print $1, $2, $3, $4, $5, $6}'
    )


    ##################################################
    # Summary
    ##################################################

    echo
    echo "========== Disk Summary =========="
    echo

    echo "Critical Filesystems : $critical_count"
    echo "Warning Filesystems  : $warning_count"

    echo

    if [ "$critical_count" -gt 0 ]; then

        error "One or more filesystems require immediate attention."

    elif [ "$warning_count" -gt 0 ]; then

        warning "Some filesystems are approaching capacity."

    else

        success "All monitored filesystems have sufficient free space."

    fi


    ##################################################
    # Block device overview
    ##################################################

    echo
    echo "========== Block Devices =========="
    echo

    if command -v lsblk &>/dev/null; then

        lsblk -o NAME,SIZE,FSTYPE,TYPE,MOUNTPOINTS

    else

        warning "'lsblk' command is not available."

    fi

    pause
}


##################################################
# Function : system_load
# Purpose  : Display and analyze system load average
##################################################

system_load() {

    header

    echo "========== System Load =========="
    echo

    ##################################################
    # Get CPU core count
    ##################################################

    if command -v nproc &>/dev/null; then
        cpu_cores=$(nproc)
    else
        cpu_cores=$(grep -c '^processor' /proc/cpuinfo)
    fi

    if [[ ! "$cpu_cores" =~ ^[0-9]+$ ]] ||
       [ "$cpu_cores" -le 0 ]; then

        error "Unable to determine CPU core count."
        pause
        return
    fi


    ##################################################
    # Read load averages
    ##################################################

    if [ ! -r /proc/loadavg ]; then
        error "Unable to read system load information."
        pause
        return
    fi

    read -r load1 load5 load15 running_info last_pid < /proc/loadavg

    running_processes=${running_info%/*}
    total_processes=${running_info#*/}


    ##################################################
    # Display load information
    ##################################################

    echo "CPU Cores        : $cpu_cores"
    echo
    echo "1 Minute Load    : $load1"
    echo "5 Minute Load    : $load5"
    echo "15 Minute Load   : $load15"

    echo
    echo "Running Tasks    : $running_processes"
    echo "Total Tasks      : $total_processes"

    echo


    ##################################################
    # Calculate load percentage relative to CPU cores
    ##################################################

    load_percent=$(awk \
        -v load="$load1" \
        -v cores="$cpu_cores" \
        'BEGIN {
            printf "%.2f", (load / cores) * 100
        }')

    echo "Current Load     : ${load_percent}% of CPU capacity"

    echo


    ##################################################
    # Analyze 1-minute load
    ##################################################

    load_status=$(awk \
        -v load="$load1" \
        -v cores="$cpu_cores" '
        BEGIN {

            ratio = load / cores

            if (ratio >= 1.5)
                print "critical"

            else if (ratio >= 1.0)
                print "high"

            else
                print "normal"
        }'
    )

    case "$load_status" in

        critical)
            error "System load is critically high."
            ;;

        high)
            warning "System load is high."
            ;;

        normal)
            success "System load is within normal range."
            ;;

    esac


    ##################################################
    # Load trend
    ##################################################

    echo
    echo "========== Load Trend =========="
    echo

    trend=$(awk \
        -v short="$load1" \
        -v long="$load15" '
        BEGIN {

            if (short > long * 1.20)
                print "increasing"

            else if (short < long * 0.80)
                print "decreasing"

            else
                print "stable"
        }'
    )

    case "$trend" in

        increasing)
            warning "System load appears to be increasing."
            ;;

        decreasing)
            success "System load appears to be decreasing."
            ;;

        stable)
            success "System load appears stable."
            ;;

    esac


    ##################################################
    # System uptime
    ##################################################

    echo
    echo "========== System Uptime =========="
    echo

    uptime -p 2>/dev/null || uptime

    pause
}


##################################################
# Function : top_cpu_processes
# Purpose  : Display processes using the most CPU
##################################################

top_cpu_processes() {

    header

    echo "========== Top CPU Processes =========="
    echo

    ##################################################
    # Check ps command
    ##################################################

    if ! command -v ps &>/dev/null; then
        error "'ps' command is not available."
        pause
        return
    fi

    ##################################################
    # Display top 10 CPU consuming processes
    ##################################################

    printf "%-8s %-15s %-8s %-8s %-12s %s\n" \
        "PID" "USER" "CPU%" "MEM%" "ELAPSED" "COMMAND"

    printf "%-8s %-15s %-8s %-8s %-12s %s\n" \
        "--------" "---------------" "--------" \
        "--------" "------------" "------------------------------"

    ps -eo pid,user,%cpu,%mem,etime,comm \
        --sort=-%cpu \
        --no-headers |
        head -n 10 |
        while read -r pid user cpu mem elapsed command
        do
            printf "%-8s %-15s %-8s %-8s %-12s %s\n" \
                "$pid" \
                "$user" \
                "$cpu" \
                "$mem" \
                "$elapsed" \
                "$command"
        done

    ##################################################
    # Get highest CPU process
    ##################################################

    top_process=$(ps -eo pid,user,%cpu,%mem,comm \
        --sort=-%cpu \
        --no-headers |
        head -n 1)

    if [ -z "$top_process" ]; then
        echo
        warning "Unable to determine highest CPU consuming process."
        pause
        return
    fi

    read -r top_pid top_user top_cpu top_mem top_command \
        <<< "$top_process"

    echo
    echo "========== Highest CPU Consumer =========="
    echo

    echo "PID      : $top_pid"
    echo "User     : $top_user"
    echo "CPU      : ${top_cpu}%"
    echo "Memory   : ${top_mem}%"
    echo "Command  : $top_command"

    ##################################################
    # Analyze CPU consumption
    ##################################################

    echo

    cpu_level=$(awk -v cpu="$top_cpu" '
        BEGIN {

            if (cpu >= 90)
                print "critical"

            else if (cpu >= 70)
                print "high"

            else
                print "normal"
        }
    ')

    case "$cpu_level" in

        critical)
            error "A process is consuming critically high CPU."
            ;;

        high)
            warning "A process is consuming high CPU."
            ;;

        normal)
            success "No individual process has critically high CPU usage."
            ;;

    esac

    pause
}



##################################################
# Function : top_memory_processes
# Purpose  : Display processes using the most memory
##################################################

top_memory_processes() {

    header

    echo "========== Top Memory Processes =========="
    echo

    ##################################################
    # Check ps command
    ##################################################

    if ! command -v ps &>/dev/null; then
        error "'ps' command is not available."
        pause
        return
    fi


    ##################################################
    # Display top 10 memory consuming processes
    ##################################################

    printf "%-8s %-15s %-8s %-12s %-12s %s\n" \
        "PID" "USER" "MEM%" "RSS(MB)" "ELAPSED" "COMMAND"

    printf "%-8s %-15s %-8s %-12s %-12s %s\n" \
        "--------" "---------------" "--------" \
        "------------" "------------" "------------------------------"

    ps -eo pid,user,%mem,rss,etime,comm \
        --sort=-%mem \
        --no-headers |
        head -n 10 |
        while read -r pid user mem rss elapsed command
        do

            rss_mb=$(awk \
                -v rss="$rss" \
                'BEGIN {
                    printf "%.2f", rss / 1024
                }')

            printf "%-8s %-15s %-8s %-12s %-12s %s\n" \
                "$pid" \
                "$user" \
                "$mem" \
                "$rss_mb" \
                "$elapsed" \
                "$command"

        done


    ##################################################
    # Highest memory consuming process
    ##################################################

    top_process=$(ps -eo pid,user,%mem,rss,comm \
        --sort=-%mem \
        --no-headers |
        head -n 1)

    if [ -z "$top_process" ]; then

        echo
        warning "Unable to determine highest memory consuming process."
        pause
        return
    fi

    read -r top_pid top_user top_mem top_rss top_command \
        <<< "$top_process"

    top_rss_mb=$(awk \
        -v rss="$top_rss" \
        'BEGIN {
            printf "%.2f", rss / 1024
        }')


    ##################################################
    # Display highest consumer
    ##################################################

    echo
    echo "========== Highest Memory Consumer =========="
    echo

    echo "PID      : $top_pid"
    echo "User     : $top_user"
    echo "Memory   : ${top_mem}%"
    echo "RSS      : ${top_rss_mb} MB"
    echo "Command  : $top_command"


    ##################################################
    # Analyze memory consumption
    ##################################################

    echo

    memory_level=$(awk \
        -v mem="$top_mem" '
        BEGIN {

            if (mem >= 50)
                print "critical"

            else if (mem >= 25)
                print "high"

            else
                print "normal"
        }'
    )

    case "$memory_level" in

        critical)
            error "A process is consuming critically high memory."
            ;;

        high)
            warning "A process is consuming high memory."
            ;;

        normal)
            success "No individual process has critically high memory usage."
            ;;

    esac

    pause
}


##################################################
# Function : network_statistics
# Purpose  : Display network interface and connection statistics
##################################################

network_statistics() {

    header

    echo "========== Network Statistics =========="
    echo

    ##################################################
    # Check required commands
    ##################################################

    if ! command -v ip &>/dev/null; then
        error "'ip' command is not available."
        pause
        return
    fi

    ##################################################
    # Network interfaces
    ##################################################

    echo "========== Network Interfaces =========="
    echo

    printf "%-15s %-10s %-20s\n" \
        "INTERFACE" "STATE" "IPv4 ADDRESS"

    printf "%-15s %-10s %-20s\n" \
        "---------------" "----------" "--------------------"

    while read -r interface
    do

        state=$(cat "/sys/class/net/$interface/operstate" 2>/dev/null)

        ipv4=$(ip -4 -o addr show dev "$interface" 2>/dev/null |
            awk '{print $4}' |
            paste -sd "," -)

        [ -z "$ipv4" ] && ipv4="None"
        [ -z "$state" ] && state="unknown"

        printf "%-15s %-10s %-20s\n" \
            "$interface" \
            "$state" \
            "$ipv4"

    done < <(
        find /sys/class/net \
            -mindepth 1 \
            -maxdepth 1 \
            -printf "%f\n" 2>/dev/null |
        sort
    )


    ##################################################
    # Traffic statistics
    ##################################################

    echo
    echo "========== Network Traffic =========="
    echo

    printf "%-15s %-15s %-15s %-10s %-10s\n" \
        "INTERFACE" "RX" "TX" "RX ERR" "TX ERR"

    printf "%-15s %-15s %-15s %-10s %-10s\n" \
        "---------------" "---------------" "---------------" \
        "----------" "----------"

    while read -r interface
    do

        rx_bytes=$(cat "/sys/class/net/$interface/statistics/rx_bytes" 2>/dev/null)
        tx_bytes=$(cat "/sys/class/net/$interface/statistics/tx_bytes" 2>/dev/null)

        rx_errors=$(cat "/sys/class/net/$interface/statistics/rx_errors" 2>/dev/null)
        tx_errors=$(cat "/sys/class/net/$interface/statistics/tx_errors" 2>/dev/null)

        rx_bytes=${rx_bytes:-0}
        tx_bytes=${tx_bytes:-0}
        rx_errors=${rx_errors:-0}
        tx_errors=${tx_errors:-0}

        ##################################################
        # Convert bytes to human-readable values
        ##################################################

        if command -v numfmt &>/dev/null; then

            rx_human=$(numfmt \
                --to=iec-i \
                --suffix=B \
                "$rx_bytes" 2>/dev/null)

            tx_human=$(numfmt \
                --to=iec-i \
                --suffix=B \
                "$tx_bytes" 2>/dev/null)

        else

            rx_human="${rx_bytes} B"
            tx_human="${tx_bytes} B"

        fi

        printf "%-15s %-15s %-15s %-10s %-10s\n" \
            "$interface" \
            "$rx_human" \
            "$tx_human" \
            "$rx_errors" \
            "$tx_errors"

    done < <(
        find /sys/class/net \
            -mindepth 1 \
            -maxdepth 1 \
            -printf "%f\n" 2>/dev/null |
        sort
    )


    ##################################################
    # Packet drops
    ##################################################

    echo
    echo "========== Packet Drops =========="
    echo

    drop_detected=0

    while read -r interface
    do

        rx_drop=$(cat \
            "/sys/class/net/$interface/statistics/rx_dropped" \
            2>/dev/null)

        tx_drop=$(cat \
            "/sys/class/net/$interface/statistics/tx_dropped" \
            2>/dev/null)

        rx_drop=${rx_drop:-0}
        tx_drop=${tx_drop:-0}

        echo "$interface"
        echo "  RX Dropped : $rx_drop"
        echo "  TX Dropped : $tx_drop"

        if [ "$rx_drop" -gt 0 ] ||
           [ "$tx_drop" -gt 0 ]; then

            ((drop_detected++))
        fi

    done < <(
        find /sys/class/net \
            -mindepth 1 \
            -maxdepth 1 \
            -printf "%f\n" 2>/dev/null |
        sort
    )

    echo

    if [ "$drop_detected" -gt 0 ]; then
        warning "Packet drops detected on one or more interfaces."
    else
        success "No packet drops detected."
    fi


    ##################################################
    # Network connection statistics
    ##################################################

    echo
    echo "========== Connection Summary =========="
    echo

    if command -v ss &>/dev/null; then

        established=$(ss -Htan state established 2>/dev/null |
            wc -l)

        listening_tcp=$(ss -Hltn 2>/dev/null |
            wc -l)

        listening_udp=$(ss -Hlun 2>/dev/null |
            wc -l)

        echo "Established TCP Connections : $established"
        echo "Listening TCP Sockets       : $listening_tcp"
        echo "Listening UDP Sockets       : $listening_udp"

    else

        warning "'ss' command is not available."

    fi


    ##################################################
    # Default gateway
    ##################################################

    echo
    echo "========== Default Route =========="
    echo

    default_route=$(ip route show default 2>/dev/null)

    if [ -n "$default_route" ]; then
        echo "$default_route"
    else
        warning "No default route configured."
    fi


    ##################################################
    # DNS information
    ##################################################

    echo
    echo "========== DNS Servers =========="
    echo

    if [ -r /etc/resolv.conf ]; then

        dns_servers=$(awk '
            $1 == "nameserver" {
                print $2
            }
        ' /etc/resolv.conf)

        if [ -n "$dns_servers" ]; then
            echo "$dns_servers"
        else
            warning "No DNS nameservers found."
        fi

    else
        warning "Unable to read /etc/resolv.conf."
    fi

    pause
}



##################################################
# Function : disk_io_statistics
# Purpose  : Display disk I/O performance statistics
##################################################

disk_io_statistics() {

    header

    echo "========== Disk I/O Statistics =========="
    echo


    ##################################################
    # Block Device Information
    ##################################################

    echo "========== Block Devices =========="
    echo

    if command -v lsblk &>/dev/null; then

        lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS

    else

        warning "'lsblk' command is not available."

    fi

    echo


    ##################################################
    # Check iostat availability
    ##################################################

    echo "========== I/O Performance =========="
    echo

    if command -v iostat &>/dev/null; then

        ##################################################
        # Extended disk statistics
        #
        # First report  = since boot
        # Second report = current 1-second sample
        ##################################################

        iostat -dx 1 2 |
            awk '
                BEGIN {
                    report = 0
                }

                /^Device/ {
                    report++
                }

                report >= 2 {
                    print
                }
            '

    else

        warning "'iostat' command is not available."
        echo
        echo "Detailed disk performance statistics require"
        echo "the sysstat package."
        echo
        echo "On RHEL-based systems:"
        echo "dnf install sysstat"

    fi


    ##################################################
    # Basic /proc/diskstats information
    ##################################################

    echo
    echo "========== Basic Disk Counters =========="
    echo

    if [ -r /proc/diskstats ]; then

        printf "%-12s %-15s %-15s %-15s %-15s\n" \
            "DEVICE" \
            "READS" \
            "READ SECTORS" \
            "WRITES" \
            "WRITE SECTORS"

        printf "%-12s %-15s %-15s %-15s %-15s\n" \
            "------------" \
            "---------------" \
            "---------------" \
            "---------------" \
            "---------------"

        while read -r major minor device \
            reads read_merged read_sectors read_ms \
            writes write_merged write_sectors write_ms rest
        do

            ##################################################
            # Show only real top-level block devices
            ##################################################

            if [ ! -e "/sys/block/$device" ]; then
                continue
            fi

            printf "%-12s %-15s %-15s %-15s %-15s\n" \
                "$device" \
                "$reads" \
                "$read_sectors" \
                "$writes" \
                "$write_sectors"

        done < /proc/diskstats

    else

        warning "Unable to read /proc/diskstats."

    fi


    ##################################################
    # I/O Health Analysis
    ##################################################

    echo
    echo "========== I/O Health =========="
    echo

    if command -v iostat &>/dev/null; then

        high_util=0
        critical_util=0

        while read -r device util
        do

            if [ -z "$device" ] || [ -z "$util" ]; then
                continue
            fi

            status=$(awk -v value="$util" '
                BEGIN {

                    if (value >= 90)
                        print "critical"

                    else if (value >= 70)
                        print "high"

                    else
                        print "normal"
                }
            ')

            case "$status" in

                critical)

                    error "$device has critically high I/O utilization (${util}%)."
                    ((critical_util++))
                    ;;

                high)

                    warning "$device has high I/O utilization (${util}%)."
                    ((high_util++))
                    ;;

                normal)

                    success "$device I/O utilization is normal (${util}%)."
                    ;;

            esac

        done < <(
            iostat -dx 1 2 |
            awk '
                /^Device/ {
                    report++
                    next
                }

                report >= 2 &&
                NF > 0 {

                    # Last column of extended iostat
                    # output is normally %util.
                    print $1, $NF
                }
            '
        )


        ##################################################
        # Summary
        ##################################################

        echo
        echo "========== I/O Summary =========="
        echo

        echo "Critical Devices : $critical_util"
        echo "Warning Devices  : $high_util"

        echo

        if [ "$critical_util" -gt 0 ]; then

            error "One or more disks have very high I/O utilization."

        elif [ "$high_util" -gt 0 ]; then

            warning "Some disks have elevated I/O utilization."

        else

            success "Disk I/O utilization appears normal."

        fi

    else

        warning "I/O health analysis skipped because iostat is unavailable."

    fi

    pause
}


##################################################
# Function : system_uptime
# Purpose  : Display system uptime and reboot information
##################################################

system_uptime() {

    header

    echo "========== System Uptime =========="
    echo


    ##################################################
    # Current uptime
    ##################################################

    echo "========== Current Uptime =========="
    echo

    if command -v uptime &>/dev/null; then

        uptime_pretty=$(uptime -p 2>/dev/null)

        if [ -n "$uptime_pretty" ]; then
            echo "Uptime : $uptime_pretty"
        else
            uptime
        fi

    else

        warning "'uptime' command is not available."

    fi


    ##################################################
    # Boot time
    ##################################################

    echo
    echo "========== Boot Information =========="
    echo

    if command -v uptime &>/dev/null; then

        boot_time=$(uptime -s 2>/dev/null)

        if [ -n "$boot_time" ]; then
            echo "Boot Time : $boot_time"
        else
            warning "Unable to determine system boot time."
        fi

    else
        warning "Unable to determine boot time."
    fi


    ##################################################
    # Uptime in days/hours/minutes
    ##################################################

    if [ -r /proc/uptime ]; then

        uptime_seconds=$(awk '{print int($1)}' /proc/uptime)

        days=$((uptime_seconds / 86400))
        hours=$(((uptime_seconds % 86400) / 3600))
        minutes=$(((uptime_seconds % 3600) / 60))

        echo
        echo "Total Uptime:"
        echo "Days    : $days"
        echo "Hours   : $hours"
        echo "Minutes : $minutes"

    fi


    ##################################################
    # Load average
    ##################################################

    echo
    echo "========== Load Average =========="
    echo

    if [ -r /proc/loadavg ]; then

        read -r load1 load5 load15 _ < /proc/loadavg

        echo "1 Minute  : $load1"
        echo "5 Minutes : $load5"
        echo "15 Minutes: $load15"

    else

        warning "Unable to read load average."

    fi


    ##################################################
    # Last reboot
    ##################################################

    echo
    echo "========== Last Reboot =========="
    echo

    if command -v who &>/dev/null; then

        last_boot=$(who -b 2>/dev/null)

        if [ -n "$last_boot" ]; then
            echo "$last_boot"
        else
            warning "Unable to determine last reboot."
        fi

    else
        warning "'who' command is not available."
    fi


    ##################################################
    # Recent reboot history
    ##################################################

    echo
    echo "========== Recent Reboot History =========="
    echo

    if command -v last &>/dev/null; then

        reboot_history=$(last reboot 2>/dev/null | head -n 5)

        if [ -n "$reboot_history" ]; then
            echo "$reboot_history"
        else
            warning "No reboot history available."
        fi

    else

        warning "'last' command is not available."

    fi


    ##################################################
    # Current system time
    ##################################################

    echo
    echo "========== System Time =========="
    echo

    echo "Current Time : $(date '+%d-%m-%Y %H:%M:%S')"

    if command -v timedatectl &>/dev/null; then

        timezone=$(timedatectl show \
            --property=Timezone \
            --value 2>/dev/null)

        [ -n "$timezone" ] &&
            echo "Timezone     : $timezone"

    fi

    pause
}


##################################################
# Function : logged_in_users
# Purpose  : Display currently logged-in users
##################################################

logged_in_users() {

    header

    echo "========== Logged In Users =========="
    echo


    ##################################################
    # Check who command
    ##################################################

    if ! command -v who &>/dev/null; then
        error "'who' command is not available."
        pause
        return
    fi


    ##################################################
    # Current login sessions
    ##################################################

    echo "========== Active Login Sessions =========="
    echo

    login_data=$(who 2>/dev/null)

    if [ -z "$login_data" ]; then

        warning "No active login sessions found."

    else

        printf "%-15s %-12s %-18s %-25s\n" \
            "USERNAME" "TERMINAL" "LOGIN TIME" "SOURCE"

        printf "%-15s %-12s %-18s %-25s\n" \
            "---------------" \
            "------------" \
            "------------------" \
            "-------------------------"

        while read -r username terminal date time source
        do

            source=${source:-Local}

            # Remove parentheses around source host/IP
            source="${source#(}"
            source="${source%)}"

            printf "%-15s %-12s %-18s %-25s\n" \
                "$username" \
                "$terminal" \
                "$date $time" \
                "$source"

        done <<< "$login_data"

    fi


    ##################################################
    # Session statistics
    ##################################################

    echo
    echo "========== Session Summary =========="
    echo

    total_sessions=$(who 2>/dev/null | wc -l)

    unique_users=$(who 2>/dev/null |
        awk '{print $1}' |
        sort -u |
        wc -l)

    echo "Active Sessions : $total_sessions"
    echo "Unique Users    : $unique_users"


    ##################################################
    # Users with multiple sessions
    ##################################################

    echo
    echo "========== Multiple Login Sessions =========="
    echo

    multiple_sessions=$(who 2>/dev/null |
        awk '{count[$1]++}
             END {
                 for (user in count)
                     if (count[user] > 1)
                         print user, count[user]
             }' |
        sort)

    if [ -n "$multiple_sessions" ]; then

        printf "%-20s %-10s\n" "USERNAME" "SESSIONS"
        printf "%-20s %-10s\n" "--------------------" "----------"

        while read -r username sessions
        do
            printf "%-20s %-10s\n" \
                "$username" \
                "$sessions"
        done <<< "$multiple_sessions"

    else

        success "No users have multiple active sessions."

    fi


    ##################################################
    # Current shell user
    ##################################################

    echo
    echo "========== Current Session =========="
    echo

    echo "Current User : $(whoami)"

    if [ -n "$SSH_CONNECTION" ]; then

        client_ip=$(awk '{print $1}' <<< "$SSH_CONNECTION")
        server_ip=$(awk '{print $3}' <<< "$SSH_CONNECTION")

        echo "Session Type : SSH"
        echo "Client IP    : $client_ip"
        echo "Server IP    : $server_ip"

    else

        echo "Session Type : Local / Non-SSH"

    fi


    ##################################################
    # Recent login history
    ##################################################

    echo
    echo "========== Recent Login History =========="
    echo

    if command -v last &>/dev/null; then

        recent_logins=$(last -n 10 2>/dev/null)

        if [ -n "$recent_logins" ]; then
            echo "$recent_logins"
        else
            warning "No recent login history available."
        fi

    else

        warning "'last' command is not available."

    fi


    ##################################################
    # Failed login information
    ##################################################

    echo
    echo "========== Recent Failed Logins =========="
    echo

    if command -v lastb &>/dev/null; then

        failed_logins=$(lastb -n 5 2>/dev/null)

        if [ -n "$failed_logins" ]; then

            warning "Recent failed login attempts detected."

            echo
            echo "$failed_logins"

        else

            success "No recent failed login attempts found."

        fi

    else

        warning "'lastb' command is not available."

    fi

    pause
}


##################################################
# Function : system_health_summary
# Purpose  : Display overall system health summary
##################################################

system_health_summary() {

    header

    echo "========== System Health Summary =========="
    echo

    critical=0
    warnings=0


    ##################################################
    # CPU Usage
    ##################################################

    read -r _ user nice system idle iowait irq softirq steal _ \
        < /proc/stat

    total1=$((user + nice + system + idle + iowait + irq + softirq + steal))
    idle1=$((idle + iowait))

    sleep 1

    read -r _ user nice system idle iowait irq softirq steal _ \
        < /proc/stat

    total2=$((user + nice + system + idle + iowait + irq + softirq + steal))
    idle2=$((idle + iowait))

    total_diff=$((total2 - total1))
    idle_diff=$((idle2 - idle1))

    if [ "$total_diff" -gt 0 ]; then

        cpu_usage=$(awk \
            -v total="$total_diff" \
            -v idle="$idle_diff" \
            'BEGIN {
                printf "%.2f", (total-idle)*100/total
            }')

    else
        cpu_usage="0.00"
    fi

    cpu_integer=${cpu_usage%.*}

    if [ "$cpu_integer" -ge 90 ]; then

        cpu_status="CRITICAL"
        ((critical++))

    elif [ "$cpu_integer" -ge 75 ]; then

        cpu_status="WARNING"
        ((warnings++))

    else
        cpu_status="OK"
    fi


    ##################################################
    # Memory Usage
    ##################################################

    mem_total=$(free -b | awk '/^Mem:/ {print $2}')
    mem_used=$(free -b | awk '/^Mem:/ {print $3}')

    if [ -n "$mem_total" ] && [ "$mem_total" -gt 0 ]; then

        memory_usage=$(awk \
            -v used="$mem_used" \
            -v total="$mem_total" \
            'BEGIN {
                printf "%.2f", used*100/total
            }')

    else
        memory_usage="0.00"
    fi

    memory_integer=${memory_usage%.*}

    if [ "$memory_integer" -ge 90 ]; then

        memory_status="CRITICAL"
        ((critical++))

    elif [ "$memory_integer" -ge 75 ]; then

        memory_status="WARNING"
        ((warnings++))

    else
        memory_status="OK"
    fi


    ##################################################
    # Swap Usage
    ##################################################

    swap_total=$(free -b | awk '/^Swap:/ {print $2}')
    swap_used=$(free -b | awk '/^Swap:/ {print $3}')

    if [ -n "$swap_total" ] && [ "$swap_total" -gt 0 ]; then

        swap_usage=$(awk \
            -v used="$swap_used" \
            -v total="$swap_total" \
            'BEGIN {
                printf "%.2f", used*100/total
            }')

        swap_integer=${swap_usage%.*}

        if [ "$swap_integer" -ge 90 ]; then

            swap_status="CRITICAL"
            ((critical++))

        elif [ "$swap_integer" -ge 75 ]; then

            swap_status="WARNING"
            ((warnings++))

        else
            swap_status="OK"
        fi

    else

        swap_usage="N/A"
        swap_status="NO SWAP"

    fi


    ##################################################
    # Disk Usage
    ##################################################

    max_disk_usage=0
    max_disk_mount=""

    while read -r usage mountpoint
    do

        usage=${usage%\%}

        if [[ "$usage" =~ ^[0-9]+$ ]] &&
           [ "$usage" -gt "$max_disk_usage" ]; then

            max_disk_usage="$usage"
            max_disk_mount="$mountpoint"
        fi

    done < <(
        df -P -x tmpfs -x devtmpfs 2>/dev/null |
        awk 'NR > 1 {print $5, $6}'
    )

    if [ "$max_disk_usage" -ge 90 ]; then

        disk_status="CRITICAL"
        ((critical++))

    elif [ "$max_disk_usage" -ge 80 ]; then

        disk_status="WARNING"
        ((warnings++))

    else
        disk_status="OK"
    fi


    ##################################################
    # System Load
    ##################################################

    cpu_cores=$(nproc 2>/dev/null)

    if [[ ! "$cpu_cores" =~ ^[0-9]+$ ]] ||
       [ "$cpu_cores" -le 0 ]; then

        cpu_cores=1
    fi

    read -r load1 load5 load15 _ < /proc/loadavg

    load_status=$(awk \
        -v load="$load1" \
        -v cores="$cpu_cores" '
        BEGIN {

            ratio=load/cores

            if (ratio >= 1.5)
                print "CRITICAL"

            else if (ratio >= 1.0)
                print "WARNING"

            else
                print "OK"
        }'
    )

    case "$load_status" in

        CRITICAL)
            ((critical++))
            ;;

        WARNING)
            ((warnings++))
            ;;

    esac


    ##################################################
    # Failed Services
    ##################################################

    failed_services=$(systemctl \
        --failed \
        --type=service \
        --no-legend \
        --plain 2>/dev/null |
        awk 'NF {count++} END {print count+0}')

    if [ "$failed_services" -gt 0 ]; then

        service_status="WARNING"
        ((warnings++))

    else
        service_status="OK"
    fi


    ##################################################
    # Network Connectivity
    ##################################################

    default_interface=$(ip route show default 2>/dev/null |
        awk '/default/ {
            for(i=1;i<=NF;i++)
                if($i=="dev") {
                    print $(i+1)
                    exit
                }
        }')

    if [ -n "$default_interface" ] &&
       [ -d "/sys/class/net/$default_interface" ]; then

        network_state=$(cat \
            "/sys/class/net/$default_interface/operstate" \
            2>/dev/null)

        if [ "$network_state" = "up" ]; then
            network_status="OK"
        else
            network_status="WARNING"
            ((warnings++))
        fi

    else

        network_state="No default route"
        network_status="WARNING"
        ((warnings++))

    fi


    ##################################################
    # System Uptime
    ##################################################

    if [ -r /proc/uptime ]; then

        uptime_seconds=$(awk '{print int($1)}' /proc/uptime)

        uptime_days=$((uptime_seconds / 86400))
        uptime_hours=$(((uptime_seconds % 86400) / 3600))
        uptime_minutes=$(((uptime_seconds % 3600) / 60))

        uptime_text="${uptime_days}d ${uptime_hours}h ${uptime_minutes}m"

    else

        uptime_text="Unknown"

    fi


    ##################################################
    # Display Dashboard
    ##################################################

    printf "%-22s %-18s %-12s\n" \
        "RESOURCE" "VALUE" "STATUS"

    printf "%-22s %-18s %-12s\n" \
        "----------------------" \
        "------------------" \
        "------------"

    printf "%-22s %-18s %-12s\n" \
        "CPU Usage" \
        "${cpu_usage}%" \
        "[$cpu_status]"

    printf "%-22s %-18s %-12s\n" \
        "Memory Usage" \
        "${memory_usage}%" \
        "[$memory_status]"

    if [ "$swap_usage" = "N/A" ]; then

        printf "%-22s %-18s %-12s\n" \
            "Swap Usage" \
            "Not configured" \
            "[$swap_status]"

    else

        printf "%-22s %-18s %-12s\n" \
            "Swap Usage" \
            "${swap_usage}%" \
            "[$swap_status]"

    fi

    printf "%-22s %-18s %-12s\n" \
        "Highest Disk Usage" \
        "${max_disk_usage}%" \
        "[$disk_status]"

    printf "%-22s %-18s %-12s\n" \
        "System Load" \
        "$load1 / $cpu_cores cores" \
        "[$load_status]"

    printf "%-22s %-18s %-12s\n" \
        "Failed Services" \
        "$failed_services" \
        "[$service_status]"

    printf "%-22s %-18s %-12s\n" \
        "Network" \
        "${network_state:-Unknown}" \
        "[$network_status]"

    printf "%-22s %-18s %-12s\n" \
        "System Uptime" \
        "$uptime_text" \
        "[INFO]"


    ##################################################
    # Additional Information
    ##################################################

    echo
    echo "Highest Disk Mount : ${max_disk_mount:-Unknown}"
    echo "Default Interface  : ${default_interface:-Unknown}"


    ##################################################
    # Overall Health
    ##################################################

    echo
    echo "=============================================="
    echo "              Health Result"
    echo "=============================================="
    echo

    echo "Critical Issues : $critical"
    echo "Warnings        : $warnings"

    echo

    if [ "$critical" -gt 0 ]; then

        error "Overall System Health : CRITICAL"

    elif [ "$warnings" -gt 0 ]; then

        warning "Overall System Health : WARNING"

    else

        success "Overall System Health : HEALTHY"

    fi

    echo
    echo "=============================================="

    pause
}


##################################################
# Function : monitoring_menu
# Purpose  : Display System Monitoring Menu
##################################################

monitoring_menu() {

    while true
    do

        header

        echo "========== System Monitoring =========="
        echo
        echo "1. CPU Usage"
        echo "2. Memory Usage"
        echo "3. Disk Usage"
        echo "4. System Load"
        echo "5. Top CPU Processes"
        echo "6. Top Memory Processes"
        echo "7. Network Statistics"
        echo "8. Disk I/O Statistics"
        echo "9. System Uptime"
        echo "10. Logged In Users"
        echo "11. System Health Summary"
        echo
        echo "0. Back"
        echo

        read -p "Choose Option : " choice

        case "$choice" in

            1)
                cpu_usage
                ;;

            2)
                cpu_usage
                ;;
            
            3) 
                disk_usage
                ;;

            4)
                system_load
                ;;

            5)
                top_cpu_processes
                ;;

            6)
                top_memory_processes
                ;;
            
            7)
                network_statistics
                ;;

            8)
                disk_io_statistics
                ;;

            9)
                system_uptime
                ;;

            10)
                logged_in_users
                ;;

            11)
                system_health_summary
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