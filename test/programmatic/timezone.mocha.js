var Timezone = require('../../lib/Timezone.js');
var should = require('should');
var pm2 = require('../..');
var Configuration = require('../../lib/Configuration.js');
var Worker = require('../../lib/Worker.js');

describe('Timezone', function () {
  before(function (done) {
    pm2.connect(function (err) {
      should.not.exists(err);
      Configuration.unset('pm2:timezone', done);
    });
  });

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

  it('calculates next midnight in target timezone across DST', function () {
    Timezone.msUntilNextMidnight(new Date('2026-01-01T16:10:00.000Z'), 'Asia/Shanghai').should.eql(85800000);
    Timezone.msUntilNextMidnight(new Date('2026-03-08T05:30:00.000Z'), 'America/New_York').should.eql(81000000);
  });

  it('ignores a previous midnight rotation callback after rescheduling', function () {
    var originalSetTimeout = global.setTimeout;
    var originalClearTimeout = global.clearTimeout;
    var timers = [];
    var rotateCallbacks = [];
    var God = {
      rotateDateLogs: function (cb) {
        rotateCallbacks.push(cb);
      }
    };

    global.setTimeout = function (fn) {
      var timer = { fn: fn, cleared: false };
      timers.push(timer);
      return timer;
    };
    global.clearTimeout = function (timer) {
      timer.cleared = true;
    };

    try {
      Worker(God);
      God.Worker.scheduleMidnightRotation();
      timers[0].fn();
      God.Worker.scheduleMidnightRotation();
      rotateCallbacks[0]();
      timers.filter(function (timer) { return !timer.cleared; }).length.should.eql(1);
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  it('does not persist invalid global timezone', function (done) {
    pm2.set('pm2:timezone', 'UTC+8', function (err) {
      should.exists(err);
      should.not.exists(Configuration.getSync('pm2:timezone'));
      done();
    });
  });

  it('rebuilds cron jobs after timezone update', function (done) {
    pm2.start({ script: 'test/fixtures/cron.js', name: 'timezone-cron', cron_restart: '* * * * * *' }, function (err) {
      should.not.exists(err);
      var executeRemote = pm2.Client.executeRemote;
      var refreshResult;
      pm2.Client.executeRemote = function (method, data, cb) {
        return executeRemote.call(this, method, data, function (refreshErr, result) {
          if (method === 'refreshTimezone')
            refreshResult = result;
          return cb(refreshErr, result);
        });
      };
      pm2.set('pm2:timezone', 'Asia/Shanghai', function (setErr) {
        pm2.Client.executeRemote = executeRemote;
        should.not.exists(setErr);
        refreshResult.timezone.should.eql('Asia/Shanghai');
        refreshResult.cronJobs.should.eql(1);
        pm2.delete('timezone-cron', function (deleteErr) {
          should.not.exists(deleteErr);
          done();
        });
      });
    });
  });

  it('refreshes cron jobs after timezone unset', function (done) {
    var executeRemote = pm2.Client.executeRemote;
    var refreshResult;
    pm2.Client.executeRemote = function (method, data, cb) {
      return executeRemote.call(this, method, data, function (refreshErr, result) {
        if (method === 'refreshTimezone')
          refreshResult = result;
        return cb(refreshErr, result);
      });
    };
    pm2.unset('pm2:timezone', function (err) {
      pm2.Client.executeRemote = executeRemote;
      should.not.exists(err);
      should.not.exists(refreshResult.timezone);
      refreshResult.cronJobs.should.eql(0);
      done();
    });
  });

  after(function (done) {
    pm2.unset('pm2:timezone', function (err) {
      pm2.disconnect(function () {
        done(err);
      });
    });
  });
});
