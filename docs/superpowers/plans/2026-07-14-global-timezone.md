# Global Timezone Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add pm2:timezone so PM2 uses an IANA timezone for cron scheduling and PM2-generated or PM2-formatted absolute timestamps.

**Architecture:** Add lib/Timezone.js for validation and Day.js timezone formatting. The CLI validates and saves configuration, then calls daemon RPC to update cron jobs, date-log rotation, and live process containers. Timestamp writers and renderers call the shared formatter. Durations stay unchanged.

**Tech Stack:** Node.js >= 16, CommonJS, Day.js utc and timezone plugins, Croner 4, Mocha, Should.js, Bash e2e tests.

## Global Constraints

- Key is pm2:timezone; valid inputs are IANA names accepted by Intl.DateTimeFormat, including UTC.
- Missing key retains host-local timezone output.
- Invalid values are not persisted.
- Do not alter application TZ, restart applications solely for timezone update, rewrite logs, or change elapsed-time calculations.
- Rebuild all cron jobs immediately after set or unset.

---

## File Structure

- Create lib/Timezone.js: validation, config lookup, Day.js setup, timestamp/date-key formatting, next-midnight delay.
- Modify lib/API/Configuration.js: key validation and daemon refresh after set/unset.
- Modify lib/Daemon.js, lib/God/ActionMethods.js, lib/Worker.js: RPC, cron rebuild, midnight rotation.
- Modify lib/ProcessContainer.js, lib/ProcessContainerBun.js, lib/God/ForkMode.js: live IPC update and PM2 log prefixes.
- Modify lib/Common.js, lib/God.js, lib/API/Log.js, lib/API/UX/pm2-describe.js, lib/API/UX/pm2-ls.js: PM2 absolute-time output.
- Create test/programmatic/timezone.mocha.js; modify test/programmatic/logs.js, test/e2e/misc/cron-system.sh, README.md.

### Task 1: Shared timezone utility

**Files:**
- Create: lib/Timezone.js
- Test: test/programmatic/timezone.mocha.js

**Interfaces:**
- Produces isValid(timezone), get(), format(date, format, timezone), dateKey(date, timezone), msUntilNextMidnight(date, timezone).
- Consumes Configuration.getSync('pm2:timezone'); callers do not read this key directly.

- [ ] **Step 1: Write failing tests**

    var Timezone = require('../../lib/Timezone.js');

    it('accepts IANA timezone names and rejects invalid names', function () {
      Timezone.isValid('Asia/Shanghai').should.be.true();
      Timezone.isValid('UTC').should.be.true();
      Timezone.isValid('UTC+8').should.be.false();
    });

    it('formats instant in configured timezone', function () {
      Timezone.format(new Date('2026-01-02T00:00:00.000Z'), 'YYYY-MM-DD HH:mm Z', 'Asia/Shanghai')
        .should.eql('2026-01-02 08:00 +08:00');
      Timezone.dateKey(new Date('2026-01-01T16:00:00.000Z'), 'Asia/Shanghai').should.eql('20260102');
    });

- [ ] **Step 2: Verify RED**

Run: npx mocha --exit test/programmatic/timezone.mocha.js

Expected: FAIL with missing lib/Timezone.js.

- [ ] **Step 3: Implement minimum utility**

    var dayjs = require('dayjs');
    var utc = require('dayjs/plugin/utc');
    var timezone = require('dayjs/plugin/timezone');
    var Configuration = require('./Configuration.js');

    dayjs.extend(utc);
    dayjs.extend(timezone);

    exports.isValid = function (value) {
      if (typeof value !== 'string' || value.length === 0) return false;
      try { Intl.DateTimeFormat(undefined, { timeZone: value }); return true; }
      catch (err) { return false; }
    };
    exports.get = function () {
      var value = Configuration.getSync('pm2:timezone');
      return exports.isValid(value) ? value : null;
    };
    exports.format = function (date, format, value) {
      var zone = typeof value === 'undefined' ? exports.get() : value;
      return zone ? dayjs(date).tz(zone).format(format) : dayjs(date).format(format);
    };
    exports.dateKey = function (date, value) { return exports.format(date, 'YYYYMMDD', value); };

Implement msUntilNextMidnight using target-zone calendar arithmetic and local Day.js arithmetic when timezone is null.

- [ ] **Step 4: Verify GREEN**

Run: npx mocha --exit test/programmatic/timezone.mocha.js

Expected: PASS.

- [ ] **Step 5: Commit**

    git add lib/Timezone.js test/programmatic/timezone.mocha.js
    git commit -s -S -m "feat: add timezone utility"

### Task 2: Validate configuration and refresh cron jobs

**Files:**
- Modify: lib/API/Configuration.js:51-82,144-158
- Modify: lib/Daemon.js:216-250
- Modify: lib/God/ActionMethods.js
- Modify: lib/Worker.js:24-48,153-200
- Test: test/programmatic/timezone.mocha.js

**Interfaces:**
- Adds refreshTimezone(env, cb) daemon RPC returning { timezone, cronJobs }.
- set('pm2:timezone', value) validates before writing then invokes refreshTimezone.
- unset('pm2:timezone') invokes refreshTimezone after removal.

- [ ] **Step 1: Write failing tests**

    it('does not persist invalid global timezone', function (done) {
      pm2.set('pm2:timezone', 'UTC+8', function (err) {
        should.exists(err);
        should.not.exists(Configuration.getSync('pm2:timezone'));
        done();
      });
    });

    it('rebuilds cron jobs after timezone update', function (done) {
      pm2.start({ script: 'cron.js', name: 'timezone-cron', cron_restart: '* * * * * *' }, function (err) {
        should.not.exists(err);
        pm2.set('pm2:timezone', 'Asia/Shanghai', function (setErr) {
          should.not.exists(setErr);
          pm2.Client.executeRemote('refreshTimezone', {}, function (refreshErr, result) {
            should.not.exists(refreshErr);
            result.timezone.should.eql('Asia/Shanghai');
            result.cronJobs.should.eql(1);
            done();
          });
        });
      });
    });

- [ ] **Step 2: Verify RED**

Run: npx mocha --exit test/programmatic/timezone.mocha.js

Expected: FAIL because invalid values persist and RPC is missing.

- [ ] **Step 3: Implement minimum behavior**

Before generic colon-key module restart logic in CLI.prototype.set:

    if (key === 'pm2:timezone' && !Timezone.isValid(value))
      return cb ? cb(Common.retErr('Invalid IANA timezone: ' + value)) : that.exitCli(cst.ERROR_EXIT);

After set/unset of this key, call Client.executeRemote('refreshTimezone', {}, callback); never restart app named pm2. Expose refreshTimezone in Daemon.

God.refreshTimezone reads Timezone.get(), stops every CronJobs entry, clears map, calls registerCron for each clusters_db pm2_env, reschedules midnight rotation, and returns selected timezone/map size. Register Croner with:

    var job = Cron(pm2_env.cron_restart, { timezone: Timezone.get() || undefined }, callback);

Worker tracks its midnight timer, clears it before rescheduling, and uses Timezone.msUntilNextMidnight(new Date()).

- [ ] **Step 4: Verify GREEN**

Run: npx mocha --exit test/programmatic/timezone.mocha.js

Expected: PASS; invalid value stays absent and valid update rebuilds cron job.

- [ ] **Step 5: Commit**

    git add lib/API/Configuration.js lib/Daemon.js lib/God/ActionMethods.js lib/Worker.js test/programmatic/timezone.mocha.js
    git commit -s -S -m "feat: refresh timezone configuration"

### Task 3: Apply timezone to live PM2-managed log timestamps and date files

**Files:**
- Modify: lib/ProcessContainer.js:122-231
- Modify: lib/ProcessContainerBun.js:107-294
- Modify: lib/God/ForkMode.js:128-205
- Modify: lib/God.js:95-112
- Modify: lib/Common.js:268-285
- Modify: lib/God/ActionMethods.js:662-675
- Test: test/programmatic/logs.js and test/programmatic/timezone.mocha.js

**Interfaces:**
- Daemon sends { type: 'timezone:update', data: { timezone } } to live containers and updates pm2_env.pm2_timezone.
- Containers use pm2_timezone only for PM2-added timestamp fields.

- [ ] **Step 1: Write failing tests**

    it('prefixes PM2-managed log with configured timezone', function (done) {
      pm2.set('pm2:timezone', 'Asia/Shanghai', function (err) {
        should.not.exists(err);
        pm2.start({ script: 'echo.js', name: 'timezone-log', log_date_format: 'YYYY-MM-DD HH:mm Z' }, function (startErr) {
          should.not.exists(startErr);
          // Assert emitted PM2 log prefix matches / \+08:00: /.
          done();
        });
      });
    });

Add deterministic dateKey coverage for an instant crossing target-zone day boundary.

- [ ] **Step 2: Verify RED**

Run: npx mocha --exit test/programmatic/logs.js test/programmatic/timezone.mocha.js

Expected: FAIL because writers still call local dayjs().

- [ ] **Step 3: Implement minimum behavior**

Replace PM2-created dayjs().format(pm2_env.log_date_format) with:

    Timezone.format(new Date(), pm2_env.log_date_format, pm2_env.pm2_timezone)

Use Timezone.format(new Date(), 'YYYY-MM-DDTHH:mm:ssZ', pm2_env.pm2_timezone) for PM2-created JSON fallback values and exit separators. Add both container message handlers:

    if (msg.type === 'timezone:update') {
      pm2_env.pm2_timezone = msg.data && msg.data.timezone || null;
      return;
    }

refreshTimezone updates daemon-side environments and calls send where available. Use Timezone.dateKey(new Date()) in Common.js and date-log rotation.

- [ ] **Step 4: Verify GREEN**

Run: npx mocha --exit test/programmatic/logs.js test/programmatic/timezone.mocha.js

Expected: PASS; +08:00 appears in new PM2 log output and live containers update without restart.

- [ ] **Step 5: Commit**

    git add lib/ProcessContainer.js lib/ProcessContainerBun.js lib/God/ForkMode.js lib/God.js lib/Common.js lib/God/ActionMethods.js test/programmatic/logs.js test/programmatic/timezone.mocha.js
    git commit -s -S -m "feat: apply timezone to pm2 logs"

### Task 4: Apply timezone to CLI output and document usage

**Files:**
- Modify: lib/API/Log.js:84-300
- Modify: lib/API/UX/pm2-describe.js:40-48
- Modify: lib/API/UX/pm2-ls.js:28-45
- Modify: README.md:60-70,111-140
- Modify: test/e2e/misc/cron-system.sh
- Test: test/programmatic/timezone.mocha.js

**Interfaces:**
- CLI absolute-time output calls Timezone.format(date, format).
- renderExitTime(lastExitAt) returns Timezone.format(lastExitAt, 'YYYY-MM-DD HH:mm:ss').

- [ ] **Step 1: Write failing tests**

    it('formats absolute CLI timestamp in configured timezone', function () {
      Timezone.format(new Date('2026-01-02T00:00:00.000Z'), 'YYYY-MM-DDTHH:mm:ssZ', 'America/Los_Angeles')
        .should.eql('2026-01-01T16:00:00-08:00');
    });

Append e2e coverage:

    $pm2 set pm2:timezone Asia/Shanghai
    $pm2 start cron.js --name cron-timezone -c "*/2 * * * * *" --no-vizion
    sleep 3
    should 'configured timezone cron restarts process' 'restart_time: 0' 0
    $pm2 unset pm2:timezone
    $pm2 delete cron-timezone

- [ ] **Step 2: Verify RED**

Run: npx mocha --exit test/programmatic/timezone.mocha.js && bash test/e2e/misc/cron-system.sh

Expected: FAIL before stream and UX renderers use shared formatter.

- [ ] **Step 3: Implement minimum behavior**

Replace CLI-added dayjs().format(timestamp) in Log.stream, Log.devStream, and Log.formatStream; replace describe toISOString and list manual local Date#get rendering. Add README examples:

    pm2 set pm2:timezone Asia/Shanghai
    pm2 unset pm2:timezone

Document IANA input, cron/PM2 timestamp scope, host-local fallback, and no application timezone interference.

- [ ] **Step 4: Verify GREEN**

Run: npx mocha --exit test/programmatic/timezone.mocha.js && bash test/e2e/misc/cron-system.sh

Expected: PASS.

- [ ] **Step 5: Commit**

    git add lib/API/Log.js lib/API/UX/pm2-describe.js lib/API/UX/pm2-ls.js README.md test/programmatic/timezone.mocha.js test/e2e/misc/cron-system.sh
    git commit -s -S -m "docs: document global timezone"

### Task 5: Full regression verification

**Files:**
- Modify: none

- [ ] **Step 1: Run targeted tests**

Run: npx mocha --exit test/programmatic/timezone.mocha.js test/programmatic/logs.js test/programmatic/configuration.mocha.js

Expected: zero failures.

- [ ] **Step 2: Run unit suite**

Run: npm run test:unit

Expected: exit code 0.

- [ ] **Step 3: Run e2e suite**

Run: npm run test:e2e

Expected: exit code 0.

- [ ] **Step 4: Inspect final scope**

Run: git diff --check && git status --short

Expected: no whitespace errors and no unrelated files.

- [ ] **Step 5: Commit a correction only when verification changed a tracked timezone file**

    git add lib/Timezone.js lib/API/Configuration.js lib/Daemon.js lib/God/ActionMethods.js lib/Worker.js lib/ProcessContainer.js lib/ProcessContainerBun.js lib/God/ForkMode.js lib/God.js lib/Common.js lib/API/Log.js lib/API/UX/pm2-describe.js lib/API/UX/pm2-ls.js README.md test/programmatic/timezone.mocha.js test/programmatic/logs.js test/e2e/misc/cron-system.sh
    git commit -s -S -m "test: cover global timezone"
