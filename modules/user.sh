#!/bin/bash

############################################
# User Management Module
############################################


############################################
# Validate Username
############################################

validate_username() {

    local username="$1"

    if [[ ! "$username" =~ ^[a-z_][a-z0-9_-]{2,31}$ ]]; then
        return 1
    fi

    return 0
}

############################################
# Check User Exists
############################################

user_exists() {

    local username="$1"

    id "$username" &>/dev/null

}

############################################
# Create User
############################################


create_user() {

    header

    echo "========== Create User =========="
    echo

    read -p "Enter Username: " username

    # Check if input is empty
    if [ -z "$username" ]; then
        error "Username cannot be empty."
        pause
        return
    fi

    # Check if user already exists
    if id "$username" &>/dev/null; then
        error "User '$username' already exists."
        pause
        return
    fi

    # Create user with home directory
  if useradd -m "$username"; then
    success "User '$username' created successfully."
else
    error "Failed to create user."
fi
    pause
}


############################################
# Delete User
############################################

delete_user() {

    echo
    echo "Delete User - Coming Soon"
    pause

}

############################################
# User Menu
############################################

user_menu() {

while true
do

header

echo "========== User Management =========="
echo
echo "1. Create User"
echo "2. Delete User"
echo "3. Lock User"
echo "4. Unlock User"
echo "5. Reset Password"
echo "6. User Information"
echo "7. List Users"
echo
echo "0. Back"

echo

read -p "Choose Option : " choice

case $choice in

1)
create_user
;;

2)
delete_user
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