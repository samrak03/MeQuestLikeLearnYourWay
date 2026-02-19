#!/bin/bash
set -e

echo "Updating MySQL password..."
sudo mysql -e "ALTER USER 'mequest'@'localhost' IDENTIFIED BY 'mequest_pwd'; FLUSH PRIVILEGES;"

echo "Updating PostgreSQL password..."
sudo -u postgres psql -c "ALTER USER mequest WITH PASSWORD 'mequest_pwd';"

echo "✅ Password update complete!"
