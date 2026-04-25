#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

# Start apps with different stats
# App 1: will exit with code 0 once
$pm2 start cron-stop.js --name app-a --no-autorestart
# App 2: will exit with code 42 once
$pm2 start exitcode42.js --name app-b --no-autorestart

sleep 2

# Verify sorting by exit_code
$pm2 list --sort=exit_code > /tmp/tmp_out.txt
# app-a (0) should come before app-b (42) in ascending sort
LINE_A=$(grep -n "app-a" /tmp/tmp_out.txt | cut -f1 -d:)
LINE_B=$(grep -n "app-b" /tmp/tmp_out.txt | cut -f1 -d:)
[ $LINE_A -lt $LINE_B ] || fail "should sort by exit_code asc"
success "should sort by exit_code asc"

$pm2 list --sort=exit_code:desc > /tmp/tmp_out.txt
# app-b (42) should come before app-a (0) in descending sort
LINE_A=$(grep -n "app-a" /tmp/tmp_out.txt | cut -f1 -d:)
LINE_B=$(grep -n "app-b" /tmp/tmp_out.txt | cut -f1 -d:)
[ $LINE_B -lt $LINE_A ] || fail "should sort by exit_code desc"
success "should sort by exit_code desc"

# Verify sorting by starts
# Both have 1 start right now. Let's restart app-b
$pm2 restart app-b
sleep 2

$pm2 list --sort=starts > /tmp/tmp_out.txt
# app-a (1) should come before app-b (2)
LINE_A=$(grep -n "app-a" /tmp/tmp_out.txt | cut -f1 -d:)
LINE_B=$(grep -n "app-b" /tmp/tmp_out.txt | cut -f1 -d:)
[ $LINE_A -lt $LINE_B ] || fail "should sort by starts asc"
success "should sort by starts asc"

$pm2 list --sort=starts:desc > /tmp/tmp_out.txt
# app-b (2) should come before app-a (1)
LINE_A=$(grep -n "app-a" /tmp/tmp_out.txt | cut -f1 -d:)
LINE_B=$(grep -n "app-b" /tmp/tmp_out.txt | cut -f1 -d:)
[ $LINE_B -lt $LINE_A ] || fail "should sort by starts desc"
success "should sort by starts desc"

# Verify sorting by ok (success_count)
$pm2 list --sort=ok:desc > /tmp/tmp_out.txt
# app-a (1) should come before app-b (0)
LINE_A=$(grep -n "app-a" /tmp/tmp_out.txt | cut -f1 -d:)
LINE_B=$(grep -n "app-b" /tmp/tmp_out.txt | cut -f1 -d:)
[ $LINE_A -lt $LINE_B ] || fail "should sort by ok desc"
success "should sort by ok desc"

# Verify sorting by fail (failure_count)
$pm2 list --sort=fail:desc > /tmp/tmp_out.txt
# app-b (1) should come before app-a (0)
LINE_A=$(grep -n "app-a" /tmp/tmp_out.txt | cut -f1 -d:)
LINE_B=$(grep -n "app-b" /tmp/tmp_out.txt | cut -f1 -d:)
[ $LINE_B -lt $LINE_A ] || fail "should sort by fail desc"
success "should sort by fail desc"

$pm2 delete all
