# Global timezone

PM2 can use one IANA timezone for cron expressions and timestamps that PM2 creates or formats.

```bash
pm2 set pm2:timezone Asia/Shanghai
pm2 unset pm2:timezone
```

`pm2:timezone` accepts IANA timezone names recognized by the runtime, including `UTC`, `Asia/Shanghai`, and `America/Los_Angeles`. Invalid values are rejected and do not replace the saved setting. With no setting, PM2 keeps host-local timezone behavior.

Changing or unsetting the setting immediately unregisters and re-registers every PM2 cron job. Existing processes are not restarted solely to apply the timezone.

## Affected PM2 behavior

- Cron expression interpretation and cron re-registration.
- CLI-added timestamps in `pm2 logs --timestamp` and formatted live log streams.
- PM2-managed log prefixes, JSON timestamp fields, application-exit separators, and date-based log filenames.
- Absolute timestamps in `pm2 list` and `pm2 describe`.

## Unaffected behavior

- Application timezone and timestamps produced by application code.
- Existing log history; changing the setting does not rewrite old logs or filenames.
- Duration calculations, including uptime, restart delays, and timeouts.
