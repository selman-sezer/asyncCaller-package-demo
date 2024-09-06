export var TimeUnit;
(function (TimeUnit) {
  TimeUnit[(TimeUnit['Milliseconds'] = 1)] = 'Milliseconds';
  TimeUnit[(TimeUnit['Seconds'] = 1000)] = 'Seconds';
  TimeUnit[(TimeUnit['Minutes'] = 60000)] = 'Minutes';
  TimeUnit[(TimeUnit['Hours'] = 3600000)] = 'Hours';
  TimeUnit[(TimeUnit['Days'] = 86400000)] = 'Days';
})(TimeUnit || (TimeUnit = {}));
