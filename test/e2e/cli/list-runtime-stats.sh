#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path

$pm2 start cron-stop.js --name list-stats-ok --no-autorestart --no-vizion
spec "should start success fixture"

$pm2 start exitcode42.js --name list-stats-fail --no-autorestart --no-vizion
spec "should start failure fixture"

sleep 2

env -u PM2_SILENT $pm2 list > /tmp/tmp_out.txt
header_line=$(grep -m1 "lastExitTime" /tmp/tmp_out.txt)
printf '%s\n' "$header_line" | grep -q "lastExitTime"
spec "should display exit time column in list output"

printf '%s\n' "$header_line" | grep -q "totalRound"
spec "should display starts column in list output"

printf '%s\n' "$header_line" | grep -Eq '[│|][[:space:]]*ok[[:space:]]*[│|]'
spec "should display success count column in list output"

printf '%s\n' "$header_line" | grep -Eq '[│|][[:space:]]*fail[[:space:]]*[│|]'
spec "should display failure count column in list output"

$pm2 jlist > /tmp/tmp_out.json
cat > /tmp/check_stats_1.js << 'NODE'
const fs = require('fs')
const list = JSON.parse(fs.readFileSync('/tmp/tmp_out.json', 'utf8'))

function get(name) {
  const app = list.find(proc => proc.name === name)
  if (!app) throw new Error(`Missing app ${name}`)
  return app.pm2_env
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ok = get('list-stats-ok')
assert(ok.start_count === 1, 'expected success app start_count=1')
assert(ok.success_count === 1, 'expected success app success_count=1')
assert(ok.failure_count === 0, 'expected success app failure_count=0')
assert(ok.last_exit_code === 0, 'expected success app last_exit_code=0')
assert(typeof ok.last_exit_at === 'number', 'expected success app last_exit_at')

const fail = get('list-stats-fail')
assert(fail.start_count === 1, 'expected failure app start_count=1')
assert(fail.success_count === 0, 'expected failure app success_count=0')
assert(fail.failure_count === 1, 'expected failure app failure_count=1')
assert(fail.last_exit_code === 42, 'expected failure app last_exit_code=42')
assert(typeof fail.last_exit_at === 'number', 'expected failure app last_exit_at')
NODE
"$node" /tmp/check_stats_1.js
spec "should record runtime stats for exited apps"

$pm2 save
spec "should dump runtime stats"

$pm2 kill
$pm2 resurrect
sleep 1

$pm2 jlist > /tmp/tmp_out.json
cat > /tmp/check_stats_2.js << 'NODE'
const fs = require('fs')
const list = JSON.parse(fs.readFileSync('/tmp/tmp_out.json', 'utf8'))

function get(name) {
  const app = list.find(proc => proc.name === name)
  if (!app) throw new Error(`Missing app ${name}`)
  return app.pm2_env
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const ok = get('list-stats-ok')
assert(ok.start_count === 1, 'expected success app start_count persisted')
assert(ok.success_count === 1, 'expected success app success_count persisted')
assert(ok.failure_count === 0, 'expected success app failure_count persisted')
assert(ok.last_exit_code === 0, 'expected success app last_exit_code persisted')
assert(typeof ok.last_exit_at === 'number', 'expected success app last_exit_at persisted')

const fail = get('list-stats-fail')
assert(fail.start_count === 1, 'expected failure app start_count persisted')
assert(fail.success_count === 0, 'expected failure app success_count persisted')
assert(fail.failure_count === 1, 'expected failure app failure_count persisted')
assert(fail.last_exit_code === 42, 'expected failure app last_exit_code persisted')
assert(typeof fail.last_exit_at === 'number', 'expected failure app last_exit_at persisted')
NODE
"$node" /tmp/check_stats_2.js
spec "should persist runtime stats across resurrect"

$pm2 reset all
spec "should reset runtime stats"

$pm2 jlist > /tmp/tmp_out.json
cat > /tmp/check_stats_3.js << 'NODE'
const fs = require('fs')
const list = JSON.parse(fs.readFileSync('/tmp/tmp_out.json', 'utf8'))

function get(name) {
  const app = list.find(proc => proc.name === name)
  if (!app) throw new Error(`Missing app ${name}`)
  return app.pm2_env
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

for (const name of ['list-stats-ok', 'list-stats-fail']) {
  const app = get(name)
  assert(app.start_count === 0, `expected ${name} start_count reset`)
  assert(app.success_count === 0, `expected ${name} success_count reset`)
  assert(app.failure_count === 0, `expected ${name} failure_count reset`)
  assert(app.last_exit_code === null, `expected ${name} last_exit_code reset`)
  assert(app.last_exit_at === null, `expected ${name} last_exit_at reset`)
}
NODE
"$node" /tmp/check_stats_3.js
spec "should clear runtime stats on reset"

$pm2 delete all
