#!/usr/bin/env node
'use strict';

var Check = require('../check.js'),
	request = require('request'),
	ua = 'Mozilla/5.0 (check_kue) check_fhem_max/' + require('../package.json').version + ' (https://github.com/sebbo2002/nagios-checks)',
	check,
	url;

check = new Check({
	name: 'check_fhem_max',
	arguments: [
		{
			short: 'h',
			long: 'host=<STRING>',
			desc: 'FHEM-URL (`https://fhem.sebbo.net`)'
		},
		{
			short: 'd',
			long: 'device=<STRING>',
			desc: 'FHEM-DEVICE (`ml`)'
		},
		{
			long: 'disable-http-warning',
			desc: 'Disable warning for FHEM instances without SSL'
		},
		{
			long: 'disable-weekprofile-check',
			desc: 'Disable Week Profile Check'
		},
		{
			long: 'disable-mode-check',
			desc: 'Disable Mode Check'
		}
	],
	help: 'Usage: check_fhem_max [Options]\nOptions:\n[[OPTIONS]]'
});

if (!check.param('host')) {
	check.showHelp('FHEM-URL required!');
	return;
}
if (!check.param('device')) {
	check.showHelp('FHEM device name required!');
	return;
}

url = require('url').parse(check.param('host'));
if (url.protocol === 'http:' && !check.param('disable-http-warning')) {
	check.critical('FHEM access over HTTP blocked, due to security reasons. Enter a HTTPS secured address or add `disable-http-warning` to allow unsecure connections…');
	return check.send();
}
else if (url.protocol === null && url.pathname) {
	url.protocol = 'https:';
	url.hostname = url.pathname;
	url.pathname = null;
}
else if (['http:', 'https:'].indexOf(url.protocol) < 0) {
	check.critical('Unsupported protocol `%s`!', url.protocol);
	return check.send();
}


request({
	url: require('url').format(url) + 'fhem?cmd=jsonlist2%20' + encodeURIComponent(check.param('device')) + '&XHR=1',
	headers: {
		'User-Agent': ua
	}
}, function (error, response, body) {
	if (error) {
		check.critical('Unknown error: %s', error);
		return check.send();
	}

	var compareDevices,
		mainDevice;


	try {
		compareDevices = JSON.parse(body).Results;
		mainDevice = compareDevices.shift();
	}
	catch (err) {
		check.critical('JSON format error: %s', err);
		return check.send();
	}


	// General

	if (!mainDevice.Internals || !mainDevice.Readings) {
		check.critical('Device has no Internals or no Readings…');
	}

	if (mainDevice.Internals.TYPE === 'MAX' && mainDevice.Readings.MAXLAN_error.Value !== '0') {
		check.critical('Flag MAXLAN_error is not null…');
	}

	if (mainDevice.Internals.TYPE === 'MAX' && mainDevice.Readings.MAXLAN_valid.Value !== '1') {
		check.critical('Flag MAXLAN_valid is not true…');
	}

	if (mainDevice.Internals.TYPE === 'MAX' && mainDevice.Readings.battery.Value !== 'ok') {
		check.warning('Battery seems to get empty…');
	}

	if (
		mainDevice.Internals.TYPE === 'MAX' &&
		mainDevice.Internals.type !== 'PushButton' &&
		mainDevice.Internals.rferror !== '0'
	) {
		check.warning('There was an connection error…');
	}

	(function () {
		var lastUpdate = null,
			critical = 10,
			warning = 5,
			time,
			key;

		for (key in mainDevice.Readings) {
			time = new Date(mainDevice.Readings[key].Time).getTime();
			if (!lastUpdate || time > lastUpdate) {
				lastUpdate = time;
			}
		}

		if (mainDevice.Internals.TYPE === 'MAXLAN') {
			critical = 60 * 24;
			warning = 60 * 12;
		}
		if (mainDevice.Internals.type === 'PushButton') {
			critical = 60 * 24 * 60;
			warning = 60 * 24 * 45;
		}

		if (!lastUpdate) {
			check.critical('Device has no Readings…');
		}

		if (lastUpdate < new Date().getTime() - (1000 * 60 * critical)) {
			check.critical('Last update was ' + new Date(lastUpdate).toString());
		}
		else if (lastUpdate < new Date().getTime() - (1000 * 60 * warning)) {
			check.warning('Last update was ' + new Date(lastUpdate).toString());
		}
	})();


	// Cube

	if (mainDevice.Internals.TYPE === 'MAXLAN' && mainDevice.Internals.STATE !== 'opened') {
		check.critical('FHEM is not connected to cube…');
	}

	if (mainDevice.Internals.TYPE === 'MAXLAN' && mainDevice.Internals.dutycycle > 90) {
		check.critical('Cube\'s dutycycle is %s %…', mainDevice.Internals.dutycycle);
	}
	else if (mainDevice.Internals.TYPE === 'MAXLAN' && mainDevice.Internals.dutycycle > 75) {
		check.warning('Cube\'s dutycycle is %s %…', mainDevice.Internals.dutycycle);
	}

	if (mainDevice.Internals.TYPE === 'MAXLAN' && mainDevice.Internals.freememoryslot < 10) {
		check.critical('Cube has only %s memory slots left…', mainDevice.Internals.freememoryslot);
	}
	else if (mainDevice.Internals.TYPE === 'MAXLAN' && mainDevice.Internals.freememoryslot < 25) {
		check.warning('Cube has only %s memory slots left…', mainDevice.Internals.freememoryslot);
	}


	// HeatingThermostat / WallMountedThermostat

	if (
		['HeatingThermostat', 'WallMountedThermostat'].indexOf(mainDevice.Internals.type) > -1 &&
		mainDevice.Readings.mode.Value !== 'auto' && 
		!check.param('disable-mode-check')
	) {
		check.warning('Thermostat is not in auto mode…');
	}

	if (
		['HeatingThermostat', 'WallMountedThermostat'].indexOf(mainDevice.Internals.type) > -1 &&
		parseFloat(mainDevice.Readings.temperature.Value) < 2.5
	) {
		check.critical('It\'s exremely cold in here: %s °C', parseFloat(mainDevice.Readings.temperature.Value));
	}
	else if (
		['HeatingThermostat', 'WallMountedThermostat'].indexOf(mainDevice.Internals.type) > -1 &&
		parseFloat(mainDevice.Readings.temperature.Value) < 5
	) {
		check.warning('It\'s exremely cold in here: %s °C', parseFloat(mainDevice.Readings.temperature.Value));
	}

	if(['HeatingThermostat', 'WallMountedThermostat'].indexOf(mainDevice.Internals.type) > -1 && !check.param('disable-weekprofile-check')) {
		(function () {
			var day = ['1-Sun', '2-Mon', '3-Tue', '4-Wed', '5-Thu', '6-Fri', '0-Sat'][new Date().getDay()],
				now = new Date().getTime(),
				rawValues = [
					mainDevice.Readings['weekprofile-' + day + '-temp'].Value.split('/'),
					mainDevice.Readings['weekprofile-' + day + '-time'].Value.split('/')
				];

			rawValues[1].forEach(function (string, i) {
				var time = string.trim().split('-').map(function (time) {
					return new Date(
						new Date().toJSON().split('T')[0] + 'T' + time
					).getTime();
				});

				if (time[0] <= now && time[1] >= now) {
					var should = parseFloat(rawValues[0][i]),
						state = parseFloat(mainDevice.Internals.STATE);

					if (state > should) {
						check.warning('Heating should be %s °C (%s), but is set to %s °C', should, string.trim(), state);
					}
				}
			});
		})();
	}

	if(
		['HeatingThermostat', 'WallMountedThermostat'].indexOf(mainDevice.Internals.type) > -1 &&
		compareDevices.length > 0
	) {
		(function () {
			var openWindows = [];

			compareDevices.forEach(function(device) {
				if(
					device.Internals.type === 'ShutterContact' &&
					device.Readings.groupid.Value !== mainDevice.Readings.groupid.Value
				) {
					check.critical(
						'Thermostat is in group %s, but %s is in group %s…',
						mainDevice.Readings.groupid.Value,
						device.Attributes.alias ? (device.Attributes.alias + ' (' + device.Name + ')') : device.Name,
						device.Readings.groupid.Value
					);
				}

				if(device.Internals.type === 'ShutterContact' && device.Internals.STATE === 'opened') {
					openWindows.push(
						device.Attributes.alias ? (device.Attributes.alias + ' (' + device.Name + ')') : device.Name
					);
				}
			});

			if(
				openWindows.length &&
				parseFloat(mainDevice.Internals.STATE) > parseFloat(mainDevice.Readings.windowOpenTemperature.Value)
			) {
				check.critical(
					'Thermostat on, but %s windows are open (%s)…',
					openWindows.length, openWindows.join(', ')
				);
			}

			if(openWindows.length && parseFloat(mainDevice.Readings.valveposition.Value) > 0) {
				check.critical('%s windows open, but thermostat still has to heat…', openWindows.length);
			}
		})();
	}


	// PushButton
	if (mainDevice.Internals.type === 'PushButton' && mainDevice.Internals.STATE !== 'connected') {
		check.warning('Eco-Taster is not connected any more…');
	}


	// Okay Messages
	if(mainDevice.Internals.TYPE === 'MAXLAN') {
		check.ok('Connected, Dutycycle %s%', parseFloat(mainDevice.Internals.dutycycle));
	}
	else if(mainDevice.Internals.type === 'PushButton') {
		check.ok('Connected');
	}
	else if(mainDevice.Internals.type === 'HeatingThermostat') {
		check.ok('Connected, set to %s°C (is: %s°C; %s%)', parseFloat(mainDevice.Readings.state.Value), parseFloat(mainDevice.Readings.temperature.Value), parseFloat(mainDevice.Readings.valveposition.Value));
	}
	else if(mainDevice.Internals.type === 'ShutterContact') {
		check.ok('Connected and %s', mainDevice.Readings.state.Value);
	}
	else if(mainDevice.Internals.type === 'WallMountedThermostat') {
		check.ok('Connected, %s°C', parseFloat(mainDevice.Readings.temperature.Value));
	}
	else {
		check.critical('Yet unsupported device type…');
	}

	check.send();
});