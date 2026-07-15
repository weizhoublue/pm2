var Timezone = require('../../lib/Timezone.js');
var should = require('should');
var pm2 = require('../..');
var Configuration = require('../../lib/Configuration.js');

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
      pm2.set('pm2:timezone', 'Asia/Shanghai', function (setErr) {
        should.not.exists(setErr);
        pm2.Client.executeRemote('refreshTimezone', {}, function (refreshErr, result) {
          should.not.exists(refreshErr);
          result.timezone.should.eql('Asia/Shanghai');
          result.cronJobs.should.eql(1);
          pm2.delete('timezone-cron', function (deleteErr) {
            should.not.exists(deleteErr);
            pm2.unset('pm2:timezone', done);
          });
        });
      });
    });
  });

  after(function (done) {
    Configuration.unset('pm2:timezone', done);
  });
});
