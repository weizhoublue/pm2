process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var should = require('should');
var fs     = require('fs');
var path   = require('path');
var dayjs  = require('dayjs');

describe('Date-stamped log files', function() {
  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.delete('all', function() {
        setTimeout(done, 500);
      });
    });
  });

  after(function(done) {
    pm2.delete('all', function() {
      pm2.disconnect(done);
    });
  });

  describe('log_date_files enabled (default)', function() {
    it('should use date-stamped log path on start', function(done) {
      pm2.start({
        script: './echo.js',
        name: 'date-log-test-1'
      }, function(err, procs) {
        should(err).be.null();
        var out_path = procs[0].pm2_env.pm_out_log_path;
        var today = dayjs().format('YYYYMMDD');
        out_path.should.containEql(today);
        out_path.should.containEql('date-log-test-1');
        done();
      });
    });

    it('should merge stdout and stderr into single log file', function(done) {
      pm2.start({
        script: './echo.js',
        name: 'date-log-test-2'
      }, function(err, procs) {
        should(err).be.null();
        var out_path = procs[0].pm2_env.pm_out_log_path;
        var err_path = procs[0].pm2_env.pm_err_log_path;
        out_path.should.equal(err_path);
        done();
      });
    });

    it('should NOT use date-stamped log when out_file is set explicitly', function(done) {
      pm2.start({
        script: './echo.js',
        name: 'date-log-test-3',
        out_file: 'custom-out.log'
      }, function(err, procs) {
        should(err).be.null();
        var out_path = procs[0].pm2_env.pm_out_log_path;
        out_path.should.containEql('custom-out.log');
        out_path.should.not.containEql(dayjs().format('YYYYMMDD'));
        done();
      });
    });
  });

  describe('log_date_files disabled', function() {
    it('should use default out/error log paths', function(done) {
      pm2.start({
        script: './echo.js',
        name: 'date-log-test-4',
        log_date_files: false
      }, function(err, procs) {
        should(err).be.null();
        var out_path = procs[0].pm2_env.pm_out_log_path;
        var err_path = procs[0].pm2_env.pm_err_log_path;
        out_path.should.containEql('date-log-test-4-out.log');
        err_path.should.containEql('date-log-test-4-error.log');
        done();
      });
    });
  });

  describe('restart updates log path to current date', function() {
    var pm22 = new PM2.custom({ cwd : __dirname + '/../fixtures' });

    after(function(done) {
      pm22.delete('all', function() {
        pm22.disconnect(done);
      });
    });

    it('should use correct date path after restart', function(done) {
      pm22.connect(function() {
        pm22.delete('all', function() {
          var today = dayjs().format('YYYYMMDD');

          pm22.start({
            script: './echo.js',
            name: 'restart-date-test'
          }, function(err, procs) {
            should(err).be.null();
            var first_path = procs[0].pm2_env.pm_out_log_path;
            first_path.should.containEql(today);
            first_path.should.containEql('restart-date-test');

            pm22.restart('restart-date-test', function(err2) {
              should(err2).be.null();
              // After restart, fetch fresh data via list
              pm22.list(function(err3, procs2) {
                should(err3).be.null();
                procs2.length.should.greaterThan(0);
                var new_path = procs2[0].pm2_env.pm_out_log_path;
                new_path.should.containEql(today);
                new_path.should.containEql('restart-date-test');
                pm22.disconnect(function() { done(); });
              });
            });
          });
        });
      });
    });
  });
});