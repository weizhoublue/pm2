var path = require('path');
var Startup = require('../../lib/API/Startup');
var should = require('should');

describe('Startup binary path resolution', function() {
  var originalExecPathDescriptor = Object.getOwnPropertyDescriptor(process, 'execPath');
  var originalPkg = process.pkg;
  var originalMain = require.main;
  var originalMainFilename = require.main && require.main.filename;

  afterEach(function() {
    Object.defineProperty(process, 'execPath', originalExecPathDescriptor);

    if (typeof originalPkg === 'undefined')
      delete process.pkg;
    else
      process.pkg = originalPkg;

    require.main = originalMain;
    if (originalMain)
      require.main.filename = originalMainFilename;
  });

  it('should use process.execPath for snapshot installs', function() {
    Object.defineProperty(process, 'execPath', {
      value: '/usr/local/bin/pm2',
      configurable: true,
      writable: true
    });
    delete process.pkg;
    require.main.filename = '/snapshot/pm2/bin/pm2';

    should(Startup.resolvePm2BinPath()).eql('/usr/local/bin/pm2');
  });

  it('should map source installs to bin/pm2', function() {
    delete process.pkg;
    require.main.filename = '/workdir/lib/binaries/CLI.js';

    should(Startup.resolvePm2BinPath()).eql(path.resolve(__dirname, '../../bin/pm2'));
  });

  it('should use process.execPath for pkg installs', function() {
    Object.defineProperty(process, 'execPath', {
      value: '/usr/local/bin/pm2',
      configurable: true,
      writable: true
    });
    process.pkg = {};
    require.main.filename = '/workdir/lib/binaries/CLI.js';

    should(Startup.resolvePm2BinPath()).eql('/usr/local/bin/pm2');
  });

  it('should ignore the programmatic caller path', function() {
    delete process.pkg;
    require.main.filename = '/workdir/app.js';

    should(Startup.resolvePm2BinPath()).eql(path.resolve(__dirname, '../../bin/pm2'));
  });

  it('should fall back gracefully when require.main is unavailable', function() {
    delete process.pkg;
    require.main = null;

    should(Startup.resolvePm2BinPath()).eql(path.resolve(__dirname, '../../bin/pm2'));
  });
});
