#!/bin/bash

############################################################
# LinuxFlow Uninstaller
# Automate • Monitor • Manage
############################################################

set -u

############################################################
# Configuration
############################################################

APP_NAME="LinuxFlow"

INSTALL_DIR="/opt/linuxflow"
COMMAND_PATH="/usr/bin/linuxflow"
LEGACY_COMMAND_PATH="/usr/local/bin/linuxflow"

PRESERVE_DIR="/var/lib/linuxflow"


############################################################
# Colors
############################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'


############################################################
# Messages
############################################################

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}


############################################################
# Header
############################################################

uninstaller_header() {

    clear

    echo -e "${CYAN}"
    echo "==============================================================="
    echo "                    LinuxFlow Uninstaller"
    echo "                 Automate • Monitor • Manage"
    echo "==============================================================="
    echo -e "${NC}"
}


############################################################
# Root Check
############################################################

check_root() {

    if [ "$EUID" -ne 0 ]; then

        error "LinuxFlow uninstaller requires root privileges."

        echo
        echo "Run:"
        echo
        echo "    sudo ./uninstall.sh"
        echo

        exit 1
    fi

    success "Root privileges verified."
}


############################################################
# Installation Check
############################################################

check_installation() {

    if [ ! -d "$INSTALL_DIR" ] &&
       [ ! -e "$COMMAND_PATH" ] &&
       [ ! -L "$COMMAND_PATH" ]; then

        warning "LinuxFlow does not appear to be installed."
        exit 0
    fi

    success "LinuxFlow installation detected."
}


############################################################
# Preserve Runtime Data
############################################################

preserve_runtime_data() {

    info "Preserving LinuxFlow runtime data..."

    if ! mkdir -p "$PRESERVE_DIR"; then
        error "Unable to create preservation directory."
        exit 1
    fi

    local found_data=false

    for dir in logs backups reports
    do

        if [ -d "$INSTALL_DIR/$dir" ]; then

            if ! cp -a "$INSTALL_DIR/$dir" "$PRESERVE_DIR/"; then
                error "Failed to preserve '$dir'."
                exit 1
            fi

            found_data=true
        fi

    done

    if [ "$found_data" = true ]; then

        success "Runtime data preserved in:"
        echo
        echo "    $PRESERVE_DIR"

    else

        info "No runtime data was found to preserve."

    fi
}


############################################################
# Remove Global Commands
############################################################

remove_commands() {

    info "Removing LinuxFlow command..."

    rm -f "$COMMAND_PATH"
    rm -f "$LEGACY_COMMAND_PATH"

    if [ -e "$COMMAND_PATH" ] || [ -L "$COMMAND_PATH" ]; then
        error "Unable to remove LinuxFlow command."
        exit 1
    fi

    success "LinuxFlow command removed."
}


############################################################
# Remove Application
############################################################

remove_application() {

    info "Removing LinuxFlow application files..."

    if [ -d "$INSTALL_DIR" ]; then

        if ! rm -rf -- "$INSTALL_DIR"; then
            error "Unable to remove LinuxFlow installation."
            exit 1
        fi

    fi

    if [ -e "$INSTALL_DIR" ]; then
        error "LinuxFlow installation directory still exists."
        exit 1
    fi

    success "LinuxFlow application files removed."
}


############################################################
# Uninstall Confirmation
############################################################

confirm_uninstall() {

    echo
    warning "LinuxFlow will be removed from this system."
    echo

    echo "Installation:"
    echo "    $INSTALL_DIR"
    echo

    read -p "Type UNINSTALL to continue: " confirm

    if [ "$confirm" != "UNINSTALL" ]; then

        warning "Uninstallation cancelled."
        exit 0

    fi
}


############################################################
# Runtime Data Choice
############################################################

choose_data_handling() {

    echo
    echo "LinuxFlow may contain generated:"
    echo
    echo "  - Activity logs"
    echo "  - Backups"
    echo "  - Reports"
    echo

    echo "1. Preserve runtime data"
    echo "2. Permanently delete runtime data"
    echo

    read -p "Choose Option [1/2]: " data_choice

    case "$data_choice" in

        1)

            preserve_runtime_data
            ;;

        2)

            echo
            warning "Logs, backups and reports will be permanently deleted."
            echo

            read -p "Type DELETE DATA to confirm: " delete_confirm

            if [ "$delete_confirm" != "DELETE DATA" ]; then
                warning "Uninstallation cancelled."
                exit 0
            fi

            info "Runtime data will be permanently removed."
            ;;

        *)

            error "Invalid option."
            exit 1
            ;;

    esac
}


############################################################
# Final Validation
############################################################

final_validation() {

    if [ -d "$INSTALL_DIR" ]; then
        error "Installation directory still exists."
        exit 1
    fi

    if [ -e "$COMMAND_PATH" ] || [ -L "$COMMAND_PATH" ]; then
        error "LinuxFlow command still exists."
        exit 1
    fi

    success "LinuxFlow removal validated successfully."
}


############################################################
# Main
############################################################

main() {

    uninstaller_header

    check_root

    echo
    check_installation

    confirm_uninstall

    choose_data_handling

    echo
    remove_commands

    echo
    remove_application

    echo
    final_validation

    echo
    echo "==============================================================="
    success "LinuxFlow has been uninstalled successfully."
    echo "==============================================================="

    if [ -d "$PRESERVE_DIR" ]; then

        echo
        echo "Preserved data:"
        echo
        echo "    $PRESERVE_DIR"

    fi

    echo
}


main "$@"