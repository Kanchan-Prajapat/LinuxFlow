#!/bin/bash

############################################
# LinuxFlow Common Library
############################################

# Load Configuration
if [ -f "./config/linuxflow.conf" ]; then

    source ./config/linuxflow.conf

else

    echo "ERROR: LinuxFlow configuration file not found."
    exit 1

fi

############################################
# Colors
############################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

############################################
# Clear Screen
############################################

clear_screen() {
    clear
}

############################################
# Pause
############################################

pause() {
    echo
    read -p "Press Enter to continue..."
}

log_activity() {

    if [ "$ENABLE_LOGGING" = true ]; then

        log_dir=$(dirname "$LOG_FILE")

        if [ ! -d "$log_dir" ]; then
            mkdir -p "$log_dir" 2>/dev/null
        fi

        echo "$(date +"$DATE_FORMAT") | USER=$(whoami) | HOST=$(hostname) | $1" \
            >> "$LOG_FILE" 2>/dev/null

    fi
}

############################################
# Header
############################################

header() {

    clear_screen

    echo -e "${CYAN}"
    echo "==============================================================="
    echo "                     $APP_NAME"
    echo "               Automate • Monitor • Manage"
    echo "==============================================================="
    echo -e "${NC}"

    echo "Version : $VERSION"
    echo "Author  : $AUTHOR"
    echo "Date    : $(date +"$DATE_FORMAT")"

    echo
}

############################################
# Message
############################################
success() {

    echo
    echo -e "${GREEN}[SUCCESS]${NC} $1"

    log_activity "SUCCESS : $1"

}

error() {

    echo
    echo -e "${RED}[ERROR]${NC} $1"

    log_activity "ERROR : $1"

}

warning() {

    echo
    echo -e "${YELLOW}[WARNING]${NC} $1"

    log_activity "WARNING : $1"

}