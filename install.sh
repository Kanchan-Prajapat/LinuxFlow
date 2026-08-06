!/bin/bash

############################################################
# LinuxFlow Installer
# Automate • Monitor • Manage
############################################################

set -u

############################################################
# Installer Information
############################################################

APP_NAME="LinuxFlow"
INSTALL_DIR="/opt/linuxflow"
COMMAND_PATH="/usr/bin/linuxflow"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"




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

installer_header() {

    clear

    echo -e "${CYAN}"
    echo "==============================================================="
    echo "                     LinuxFlow Installer"
    echo "                 Automate • Monitor • Manage"
    echo "==============================================================="
    echo -e "${NC}"
}


############################################################
# Root Check
############################################################

check_root() {

    if [ "$EUID" -ne 0 ]; then

        error "LinuxFlow installer must be run with root privileges."
        echo
        echo "Run:"
        echo
        echo "    sudo ./install.sh"
        echo

        exit 1
    fi

    success "Root privileges verified."
}


############################################################
# Operating System Detection
############################################################

detect_os() {

    if [ ! -r /etc/os-release ]; then
        error "Unable to detect Linux distribution."
        exit 1
    fi

    # shellcheck disable=SC1091
    source /etc/os-release

    OS_ID="${ID:-unknown}"
    OS_NAME="${PRETTY_NAME:-Unknown Linux}"

    info "Detected operating system: $OS_NAME"

    case "$OS_ID" in

        rhel|centos|rocky|almalinux|fedora)
            PACKAGE_MANAGER="dnf"
            ;;

        *)
            error "This Linux distribution is not currently supported."
            echo
            echo "Currently supported:"
            echo "  - RHEL"
            echo "  - CentOS"
            echo "  - Rocky Linux"
            echo "  - AlmaLinux"
            echo "  - Fedora"
            exit 1
            ;;
    esac
}


############################################################
# Project Validation
############################################################

validate_source() {

    info "Validating LinuxFlow source files..."

    required_files=(
        "LinuxFlow.sh"
        "config/linuxflow.conf"
        "modules/common.sh"
        "modules/user.sh"
        "modules/group.sh"
        "modules/permission.sh"
        "modules/backup.sh"
        "modules/process.sh"
        "modules/service.sh"
        "modules/firewall.sh"
        "modules/acl.sh"
        "modules/lvm.sh"
        "modules/swap.sh"
        "modules/ssh.sh"
        "modules/cron.sh"
        "modules/monitoring.sh"
        "modules/reports.sh"
        "utils/logger.sh"
    )

    for file in "${required_files[@]}"
    do
        if [ ! -f "$SCRIPT_DIR/$file" ]; then
            error "Required file missing: $file"
            exit 1
        fi
    done

    success "LinuxFlow source validation completed."
}


############################################################
# Bash Syntax Validation
############################################################

validate_syntax() {

    info "Checking Bash syntax..."

    while IFS= read -r -d '' file
    do
        if ! bash -n "$file"; then
            error "Syntax validation failed: $file"
            exit 1
        fi

    done < <(
        find "$SCRIPT_DIR" \
            -type f \
            -name "*.sh" \
            -print0
    )

    success "All shell scripts passed syntax validation."
}


############################################################
# Dependency Check
############################################################

check_dependencies() {

    info "Checking LinuxFlow dependencies..."

    local packages=(
        firewalld
        openssh-server
        lvm2
        acl
        cronie
        sysstat
        policycoreutils-python-utils
    )

    local missing_packages=()

    for package in "${packages[@]}"
    do
        if ! rpm -q "$package" &>/dev/null; then
            missing_packages+=("$package")
        fi
    done

    if [ "${#missing_packages[@]}" -eq 0 ]; then
        success "All required packages are installed."
        return 0
    fi

    warning "Missing packages detected:"

    for package in "${missing_packages[@]}"
    do
        echo "  - $package"
    done

    echo
    read -p "Install missing dependencies? (Y/N): " confirm

    case "$confirm" in

        Y|y)

            info "Installing required packages..."

            if "$PACKAGE_MANAGER" install -y "${missing_packages[@]}"; then
                success "Dependencies installed successfully."
            else
                error "Dependency installation failed."
                exit 1
            fi
            ;;

        *)

            error "LinuxFlow installation cannot continue without required dependencies."
            exit 1
            ;;
    esac
}


############################################################
# Install LinuxFlow
############################################################
############################################################
# Install / Update LinuxFlow
############################################################

install_linuxflow() {

    info "Preparing LinuxFlow installation..."

    ########################################################
    # Create installation directory
    ########################################################

    if ! mkdir -p "$INSTALL_DIR"; then
        error "Unable to create installation directory."
        exit 1
    fi

    ########################################################
    # Detect existing installation
    ########################################################

    if [ -f "$INSTALL_DIR/LinuxFlow.sh" ]; then
        warning "Existing LinuxFlow installation detected."
        info "Application files will be updated."
        info "Logs, backups and reports will be preserved."
    else
        info "Performing fresh LinuxFlow installation."
    fi

    ########################################################
    # Install main application
    ########################################################

    if ! cp "$SCRIPT_DIR/LinuxFlow.sh" \
            "$INSTALL_DIR/LinuxFlow.sh"; then

        error "Failed to install LinuxFlow.sh."
        exit 1
    fi

    ########################################################
    # Install configuration
    ########################################################

    mkdir -p "$INSTALL_DIR/config"

    if [ ! -f "$INSTALL_DIR/config/linuxflow.conf" ]; then

        if ! cp "$SCRIPT_DIR/config/linuxflow.conf" \
                "$INSTALL_DIR/config/linuxflow.conf"; then

            error "Failed to install LinuxFlow configuration."
            exit 1
        fi

        info "Default configuration installed."

    else

        info "Existing LinuxFlow configuration preserved."

    fi

    ########################################################
    # Update modules
    ########################################################

    rm -rf "$INSTALL_DIR/modules"

    if ! cp -a "$SCRIPT_DIR/modules" "$INSTALL_DIR/modules"; then
        error "Failed to install LinuxFlow modules."
        exit 1
    fi

    ########################################################
    # Update utilities
    ########################################################

    rm -rf "$INSTALL_DIR/utils"

    if ! cp -a "$SCRIPT_DIR/utils" "$INSTALL_DIR/utils"; then
        error "Failed to install LinuxFlow utilities."
        exit 1
    fi

    ########################################################
    # Runtime directories
    ########################################################

    if ! mkdir -p \
        "$INSTALL_DIR/logs" \
        "$INSTALL_DIR/backups" \
        "$INSTALL_DIR/reports"; then

        error "Failed to initialize runtime directories."
        exit 1
    fi

    ########################################################
    # Permissions
    ########################################################

    chmod 755 "$INSTALL_DIR/LinuxFlow.sh"

    find "$INSTALL_DIR/modules" \
         "$INSTALL_DIR/utils" \
         -type f \
         -name "*.sh" \
         -exec chmod 644 {} \;

    ########################################################
    # Final result
    ########################################################

    success "LinuxFlow application files installed successfully."
}

############################################################
# Create Global Command
############################################################

create_command() {

    info "Creating global 'linuxflow' command..."

    rm -f "$COMMAND_PATH"

    if ! ln -s "$INSTALL_DIR/LinuxFlow.sh" "$COMMAND_PATH"; then
        error "Unable to create LinuxFlow command."
        exit 1
    fi

    success "Global command created: $COMMAND_PATH"
}


############################################################
# Final Validation
############################################################

final_validation() {

    info "Performing installation validation..."

    if [ ! -x "$INSTALL_DIR/LinuxFlow.sh" ]; then
        error "LinuxFlow executable validation failed."
        exit 1
    fi

    if [ ! -L "$COMMAND_PATH" ]; then
        error "LinuxFlow command validation failed."
        exit 1
    fi

    if [ ! -e "$COMMAND_PATH" ]; then
        error "LinuxFlow command target is invalid."
        exit 1
    fi

    success "LinuxFlow installation validated successfully."
}


############################################################
# Main Installer
############################################################

main() {

    installer_header

    echo "Installation Directory : $INSTALL_DIR"
    echo "Command                : $COMMAND_PATH"
    echo

    check_root

    echo
    detect_os

    echo
    validate_source

    echo
    validate_syntax

    echo
    check_dependencies

    echo
    install_linuxflow

    echo
    create_command

    echo
    final_validation

    echo
    echo "==============================================================="
    success "LinuxFlow installation completed."
    echo "==============================================================="
    echo
    echo "Run LinuxFlow using:"
    echo
    echo "    sudo linuxflow"
    echo
}


main "$@"
