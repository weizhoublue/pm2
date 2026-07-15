var Timezone = require('../../lib/Timezone.js');
var should = require('should');

describe('Timezone', function () {
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
});
