#!/bin/bash
cd /mnt/d/GitHub/MeQuest/MeQuestLikeLearnYourWay/FrontEnd
nohup python3 -m http.server 8080 > frontend.log 2>&1 &
echo " Frontend server started with PID $!"
sleep 2
cat frontend.log
