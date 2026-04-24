#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

$pm2 start cron-stop.js --name cron-list-test -c "*/2 * * * * *" --no-autorestart --no-vizion
spec "should start app with cron"

env -u PM2_SILENT $pm2 list > /tmp/tmp_out.txt

grep -q "cron" /tmp/tmp_out.txt
spec "should display cron column in list output"

grep -F -q "*/2 * * * * *" /tmp/tmp_out.txt
spec "should display cron expression in list output"

$pm2 delete cron-list-test
