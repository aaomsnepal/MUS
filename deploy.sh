#!/bin/bash
# Deploy all changes to live server
# Run this from the project directory

REMOTE="kkpramod1@190.92.174.187"
REMOTE_PATH="/var/www/df343fb3-54dc-4744-a8d8-5f2f97389862/public_html"
PW="Atharva@108aadya"

echo "=== Deploying to live server ==="

# Upload server.js
echo "Uploading server.js..."
sshpass -p "$PW" scp server.js "$REMOTE:$REMOTE_PATH/server.js"
echo "Done: server.js"

# Upload aaoms-core.js
echo "Uploading aaoms-core.js..."
sshpass -p "$PW" scp public/assets/aaoms-core.js "$REMOTE:$REMOTE_PATH/assets/aaoms-core.js"
echo "Done: aaoms-core.js"

# Upload sw.js
echo "Uploading sw.js..."
sshpass -p "$PW" scp public/sw.js "$REMOTE:$REMOTE_PATH/sw.js"
echo "Done: sw.js"

# Upload classroom.html
echo "Uploading classroom.html..."
sshpass -p "$PW" scp public/classroom.html "$REMOTE:$REMOTE_PATH/classroom.html"
echo "Done: classroom.html"

# Upload llms.txt
echo "Uploading llms.txt..."
sshpass -p "$PW" scp public/llms.txt "$REMOTE:$REMOTE_PATH/llms.txt"
echo "Done: llms.txt"

# Restart server
echo "Restarting server..."
sshpass -p "$PW" ssh "$REMOTE" "cd $REMOTE_PATH && killall -9 node; sleep 1; nohup node server.js > /dev/null 2>&1 &"
echo "Done: Server restarted"

echo "=== All deployed ==="
