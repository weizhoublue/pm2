# PM2 Copilot Instructions

This document provides guidance for AI assistants working on the PM2 codebase.

## Quick Reference

### Build, Test, and Commands

**Prerequisites:** Node.js ≥ 16.0.0 (or Bun)

**Install dependencies:**
```bash
npm install
```

**Run all tests:**
```bash
npm test
```

**Run only unit tests:**
```bash
npm run test:unit
# Or directly:
bash test/unit.sh
```

**Run a single test file:**
```bash
npx mocha --exit test/programmatic/api.mocha.js
# Or with bun:
bunx mocha --exit test/programmatic/api.mocha.js
```

**Run e2e tests:**
```bash
npm run test:e2e
# Or directly:
bash test/e2e.sh
```

**Update daemon after code changes:**
```bash
./bin/pm2 update
```

**Use development version directly:**
```bash
alias pm2='<pm2_repo_path>/bin/pm2'
pm2 ls
```

## Architecture Overview

PM2 is a process manager with a **client-server architecture** consisting of three main layers:

### 1. CLI Layer (`lib/binaries/CLI.js`)
- Entry point for `pm2` command-line tool
- Uses [Commander.js](https://github.com/tj/commander.js) for argument parsing
- Routes commands to the API via IPC/RPC

### 2. API Layer (`lib/API.js` and `lib/API/*`)
- Core business logic exposed as a programmatic interface
- Can be used as a Node.js module: `const pm2 = require('pm2')`
- Main entry point: `index.js` (wraps `lib/API.js`)
- Key methods:
  - `start()` - Start a process
  - `stop()`, `restart()`, `delete()` - Manage processes
  - `list()` - Get process list
  - `connect()` - Connect to daemon
  - `disconnect()` - Clean disconnect
  - `reload()` - Graceful reload with zero downtime
  - `getMonitorData()` - Get monitoring metrics
- Configuration handled by `lib/Configuration.js`

### 3. Daemon Layer (`lib/Daemon.js`, `lib/God.js`, `lib/God/*`)
- Long-running server process that manages actual child processes
- Lives at `$HOME/.pm2/pm2.pid` (PID file)
- **Communication:** Uses socket files (RPC via `pm2-axon`, pub/sub via `pm2-axon-rpc`)
  - RPC socket: `$HOME/.pm2/rpc.sock`
  - Pub/sub socket: `$HOME/.pm2/pub.sock`
- **Key responsibilities:**
  - Spawning and monitoring child processes (via `lib/ProcessContainer*.js`)
  - Handling process lifecycle (start, restart, stop, delete)
  - Log management (aggregates to `$HOME/.pm2/logs/`)
  - Graceful restart/reload
  - Cluster mode (load balancing)
  - Fork mode (single process)
  - Signal handling and graceful shutdown
- Key classes:
  - `God` - Core daemon logic that manages process trees
  - `ProcessContainer*` - Abstracts Node.js/Bun process execution
  - `Watcher` - File system watcher for app changes (reload trigger)
  - `Worker` - Internal worker processes

### 4. Support Components
- **Client** (`lib/Client.js`) - RPC/IPC client for communicating with daemon
- **Common** (`lib/Common.js`) - Shared utilities, validators, defaults
- **Utility** (`lib/Utility.js`) - Helper functions
- **TreeKill** (`lib/TreeKill.js`) - Clean process termination with child process cleanup

## Key Conventions

### File Organization

```
lib/
├── API.js              # Main API class
├── API/
│   ├── Configuration.js        # Config parsing & validation
│   ├── *.js                    # Feature implementations (Monit, Log, Deploy, etc.)
│   ├── ExtraMgmt/              # Extra management features
│   ├── Modules/                # Module system (custom actions, etc.)
│   └── UX/                     # User interface helpers
├── Daemon.js           # Daemon startup & initialization
├── God.js              # Core daemon process manager
├── God/
│   ├── ActionMethods.js        # Custom action handling
│   ├── ClusterMode.js          # Clustering implementation
│   ├── ForkMode.js             # Single-process mode
│   ├── Methods.js              # God method definitions
│   └── Reload.js               # Graceful reload logic
├── ProcessContainer*.js # Process execution wrappers for Node.js/Bun
├── Watcher.js          # File system monitoring
└── Client.js           # RPC/IPC communication client
```

### Naming & Style

- **Files:** PascalCase for classes, camelCase for utilities
- **Private methods:** Prefix with underscore (e.g., `_method()`)
- **Callbacks:** Use Node.js callback style (error-first)
- **Events:** Use EventEmitter2 for custom events

### Testing

- **Test structure:** `test/programmatic/` for unit tests, `test/e2e/` for behavioral tests
- **Test framework:** Mocha + Should.js
- **Mocha config:** `.mocharc.js` (10-second timeout, exit on completion, bail on first failure)
- **Retry strategy:** Tests auto-retry once on failure via `test/unit.sh`
- **Reset between tests:** Each test file includes `pm2 kill` to clean daemon state

### Process Management Concepts

- **Cluster Mode:** Multiple instances with load balancer (uses Node.js cluster module)
- **Fork Mode:** Single instance (uses `child_process.fork()`)
- **Graceful Reload:** Restarts processes without downtime via `Reload.js`
- **Exponential Backoff:** Failed restarts use increasing delay before retry
- **Memory Limit:** Processes automatically restart if memory usage exceeds threshold

### Configuration & Constants

- **Constants:** `constants.js` at project root (paths, defaults, limits)
- **Environment variables:** PM2 prefixed (e.g., `PM2_HOME`)
- **Config file:** `~/.pm2/conf.js` (user configuration)
- **Dump file:** `~/.pm2/dump.pm2` (serialized process list)

### Daemon Updates

When modifying core daemon files (`lib/Daemon.js`, `lib/God.js`, `lib/God/*`, `lib/Watcher.js`), **must restart the daemon:**

```bash
pm2 update
```

This is required for changes to take effect because daemon is already running as a separate process.

### Process State & Lifecycle

Process states managed by God:
- `stopped` - Not running
- `running` - Active
- `stopping` - In shutdown
- `errored` - Crashed or failed
- `1restart` - Waiting to restart (after exponential backoff)

## Common Development Workflows

### Adding a New CLI Command
1. Create method in `lib/API/*.js` (feature-specific file)
2. Add command handler in `lib/binaries/CLI.js` using Commander.js
3. Add tests in `test/programmatic/*.mocha.js`
4. Restart daemon: `pm2 update`

### Modifying Process Lifecycle
1. Update logic in `lib/God/*.js` (ForkMode, ClusterMode, etc.)
2. Add integration tests in `test/programmatic/*.mocha.js`
3. **Restart daemon:** `pm2 update`
4. Run full test suite: `npm test`

### Debugging
- Enable debug output: `DEBUG=pm2:* pm2 ls`
- PM2 daemon logs: `~/.pm2/pm2.log`
- Application logs: `~/.pm2/logs/`
- Process-specific errors: `pm2 logs <app_id>`

## Dependencies Worth Knowing

- **pm2-axon** - IPC/RPC communication framework
- **pm2-axon-rpc** - RPC wrapper on axon
- **commander** - CLI argument parsing
- **chokidar** - File system watching
- **async** - Async utility functions (async/eachLimit, async/series)
- **debug** - Conditional debug logging
- **semver** - Version comparison
- **ansis** - Terminal color/formatting (chalk replacement)

## Important Paths

Environment-dependent paths determined by `paths.js`:
- `PM2_HOME` - Base PM2 directory (default: `~/.pm2`)
- `DEFAULT_LOG_PATH` - Log directory
- `DUMP_FILE_PATH` - Process dump file
- `PM2_PID_FILE` - Daemon PID file
- RPC/Pub socket files

## Commit Conventions

Use prefixes in commit messages (see CONTRIBUTING.md):
- `fix:` - Bug fix
- `feat:` - New feature
- `docs:` - Documentation
- `test:` - Test updates
- `refactor:` - Code refactoring (no functional change)
- `perf:` - Performance improvement
- `BREAKING:` - Breaking change
