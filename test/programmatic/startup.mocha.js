var Startup = require('../../lib/API/Startup');
var should = require('should');

describe('Startup binary path resolution', function() {
  var originalExecPath = process.execPath;
  var originalPkg = process.pkg;
  var originalMainFilename = require.main.filename;

  afterEach(function() {
    Object.defineProperty(process, 'execPath', {
      value: originalExecPath,
      configurable: true,
      writable: true
    });

    if (typeof originalPkg === 'undefined')
      delete process.pkg;
    else
      process.pkg = originalPkg;

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

    should(Startup.resolvePm2BinPath()).eql('/workdir/bin/pm2');
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
});
