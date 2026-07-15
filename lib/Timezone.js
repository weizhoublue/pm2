var dayjs = require('dayjs');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone');
var Configuration = require('./Configuration.js');

dayjs.extend(utc);
dayjs.extend(timezone);

exports.isValid = function (value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  }
  catch (err) {
    return false;
  }
};

exports.get = function () {
  var value = Configuration.getSync('pm2:timezone');
  return exports.isValid(value) ? value : null;
};

exports.format = function (date, format, value) {
  var zone = typeof value === 'undefined' ? exports.get() : value;
  return zone ? dayjs(date).tz(zone).format(format) : dayjs(date).format(format);
};

exports.dateKey = function (date, value) {
  return exports.format(date, 'YYYYMMDD', value);
};

exports.msUntilNextMidnight = function (date, value) {
  var zone = typeof value === 'undefined' ? exports.get() : value;
  var now = dayjs(date);

  if (!zone)
    return now.add(1, 'day').startOf('day').diff(now);

  var zoned = now.tz(zone);
  var nextDate = new Date(Date.UTC(zoned.year(), zoned.month(), zoned.date() + 1));
  var nextMidnight = dayjs.tz(nextDate.toISOString().slice(0, 10), zone);

  return nextMidnight.diff(now);
};
