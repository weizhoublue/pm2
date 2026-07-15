# PM2 Global Timezone Design

## Goal

Allow one PM2 instance to use a configured IANA timezone for cron scheduling and every PM2-generated or PM2-formatted absolute timestamp.

## Configuration

- `pm2 set pm2:timezone <iana-timezone>` stores the global timezone in the existing PM2 configuration.
- The value must be an IANA timezone recognized by `Intl.DateTimeFormat`, such as `Asia/Shanghai`, `America/Los_Angeles`, or `UTC`.
- An invalid value is rejected before the configuration is written and reports a clear CLI error.
- `pm2 unset pm2:timezone` restores the existing host-local timezone behavior.

## Time Semantics

- PM2 stores instants and durations as it does today. Uptime, timeout, restart delay, and other elapsed-time calculations remain independent of timezone.
- The configured timezone controls cron expression interpretation and human-readable absolute timestamps generated or formatted by PM2.
- Daylight-saving transitions follow the IANA timezone rules provided by the JavaScript runtime.
- Existing log-file contents are immutable. PM2 does not parse or rewrite date text emitted by applications.
- PM2 does not set application-process `TZ` or otherwise change application date behavior.

## Architecture

Add one internal timezone utility responsible for reading the PM2 configuration, validating configured IANA timezone names, and formatting dates with the configured timezone. It falls back to host-local timezone when no value exists.

The daemon exposes a narrow RPC action that refreshes its timezone state. After `pm2 set pm2:timezone ...` persists a valid value, the CLI invokes that action. The daemon stops every registered cron job and recreates jobs for all managed processes that have `cron_restart`, passing the configured timezone to Croner. New, restarted, and resurrected processes use the same source of truth when registering cron jobs.

## CLI and Log Coverage

- `pm2 logs --timestamp [format]` and real-time log streaming format their added timestamp in the configured timezone.
- Application logs with `log_date_format`, including PM2-generated JSON log `timestamp` fields, use the configured timezone for PM2-added timestamps.
- PM2's application-exit separator uses the configured timezone.
- `pm2 describe` creation times and `pm2 list` last-exit times use the configured timezone.
- Existing command-line format options remain supported. With no configured timezone, output preserves current host-local behavior.

## Error Handling

- Invalid timezone values never replace the current global configuration.

## Tests

- Validate accepted IANA names, `UTC`, and rejected timezone names.
- Verify host-local fallback when `pm2:timezone` is absent.
- Verify cron registration receives the configured timezone and that changing it stops and recreates every cron job.
- Verify the affected PM2-generated log timestamps and CLI absolute-time displays use the configured timezone.
- Verify elapsed-time displays and calculations remain duration-based.
