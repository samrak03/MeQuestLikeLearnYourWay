#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /mnt/d/GitHub/MeQuest/MeQuestLikeLearnYourWay/backend
nohup npm start > backend.log 2>&1 &
echo " Backend started with PID $!"
sleep 3
cat backend.log
