#!/bin/bash
set -e

echo "Killing any stuck apt processes..."
sudo killall apt apt-get 2>/dev/null || true
sudo dpkg --configure -a

echo "Updating repositories..."
sudo apt-get update

echo "Installing MySQL and PostgreSQL..."
sudo apt-get install -y mysql-server postgresql postgresql-contrib

echo "Starting Services..."
sudo service mysql start
sudo service postgresql start

echo "Configuring MySQL..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS mequest_db;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'mequest'@'localhost' IDENTIFIED BY 'password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON mequest_db.* TO 'mequest'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

echo "Configuring PostgreSQL (ignoring errors if user/db exists)..."
sudo -u postgres psql -c "CREATE USER mequest WITH PASSWORD 'password';" || true
sudo -u postgres psql -c "CREATE DATABASE mequest_rag_db OWNER mequest;" || true

echo "✅ Database installation and configuration complete!"
