#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /mnt/d/GitHub/MeQuest/MeQuestLikeLearnYourWay/backend
echo "Starting backend synchronously..."
node src/server.js
