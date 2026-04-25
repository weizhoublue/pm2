#!/bin/bash

# PM2 Binary Smoke Test Script
# Tests core PM2 functionality on compiled binaries
# Usage: bash test/smoke-test.sh <path-to-pm2-binary>

set -o pipefail
#set -x

PM2_BIN="${1:?Error: PM2 binary path not provided. Usage: $0 <pm2-binary-path>}"

# Check if binary exists
if [ ! -f "$PM2_BIN" ]; then
  echo "Error: PM2 binary not found at $PM2_BIN"
  exit 1
fi

# Make binary executable (in case it's not)
chmod +x "$PM2_BIN"

# Setup isolated PM2 home for testing
if [ "$OSTYPE" == "msys" ] || [ "$OSTYPE" == "win32" ]; then
  # Windows
  PM2_TEST_HOME="$TEMP/.pm2-smoke-test"
else
  # Linux/macOS
  PM2_TEST_HOME="/tmp/.pm2-smoke-test"
fi

# Clean up any previous test runs
rm -rf "$PM2_TEST_HOME" || true
mkdir -p "$PM2_TEST_HOME"

# Export isolated PM2_HOME
export PM2_HOME="$PM2_TEST_HOME"

echo "════════════════════════════════════════════════════════"
echo "PM2 Binary Smoke Tests"
echo "════════════════════════════════════════════════════════"
echo "Binary: $PM2_BIN"
echo "PM2_HOME: $PM2_HOME"
echo ""

# Counter for tests
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run test
run_test() {
  local test_name="$1"
  local command="$2"
  
  echo "-------------------------------"
  echo -n "Testing: $test_name ... "
  
  local output
  output=$(eval "$command" 2>&1)
  local exit_code=$?
  if [ -n "$output" ]; then
    echo "  Output:"
    echo "$output" | sed 's/^/    /'
  fi

  if [ $exit_code -eq 0 ]; then
    echo "✓ PASS"
    ((TESTS_PASSED++))
    return 0
  else
    echo "✗ FAIL"
    echo "  Command: $command"
    echo "  Exit code: $exit_code"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Test 1: pm2 --version
run_test "pm2 --version" "$PM2_BIN --version"

# Test 2: pm2 --help
run_test "pm2 --help" "$PM2_BIN --help"

# Test 3: pm2 list (should show empty)
run_test "pm2 list (empty)" "$PM2_BIN list"

# Test 4: pm2 start with simple command
run_test "pm2 start echo test" "$PM2_BIN start 'echo hello' --name smoke-test-1"

# Test 5: pm2 list (should show started process)
run_test "pm2 list (with process)" "$PM2_BIN list"

# Test 6: pm2 info
run_test "pm2 info smoke-test-1" "$PM2_BIN info smoke-test-1"

# Test 7: pm2 stop
run_test "pm2 stop smoke-test-1" "$PM2_BIN stop smoke-test-1"

# Test 8: pm2 restart
run_test "pm2 restart smoke-test-1" "$PM2_BIN restart smoke-test-1"

# Test 9: pm2 delete
run_test "pm2 delete smoke-test-1" "$PM2_BIN delete smoke-test-1"

# Test 10: pm2 startup (generate startup script)
# Note: pm2 startup requires root/elevated privileges and will fail in unprivileged CI environments
if [ "$(id -u)" -eq 0 ]; then
  run_test "pm2 startup" "$PM2_BIN startup > /dev/null 2>&1"
else
  echo "Skipping: pm2 startup (requires root privileges)"
fi

# Test 12: pm2 save (save process list)
run_test "pm2 save" "$PM2_BIN save"

# Test 13: pm2 kill (stop daemon)
run_test "pm2 kill" "$PM2_BIN kill"

# Test 14: pm2 list (should be empty after kill)
run_test "pm2 list (after kill)" "$PM2_BIN list"

# Cleanup
echo ""
echo "════════════════════════════════════════════════════════"
echo "Cleanup..."
rm -rf "$PM2_TEST_HOME" || true

# Summary
echo ""
echo "════════════════════════════════════════════════════════"
echo "Test Results"
echo "════════════════════════════════════════════════════════"
echo "✓ Passed: $TESTS_PASSED"
echo "✗ Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo "All smoke tests passed! ✓"
  exit 0
else
  echo "Some tests failed! ✗"
  exit 1
fi
