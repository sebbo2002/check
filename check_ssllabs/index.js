#!/usr/bin/env node
'use strict';

var Check = require('../check.js'),
    ssllabs = require('node-ssllabs'),
    grades = ['-', 'A+', 'A', 'A-', 'B', 'F', 'T', 'M'],
    check;

check = new Check({
    name: 'check_ssllabs',
    arguments: [
        {
            short: 'h',
            long: 'host=<STRING>',
            desc: 'Host which should be tested'
        },
        {
            short: 'w',
            long: 'warning=<STRING>',
            desc: 'Warning threshold',
            default: 'A'
        },
        {
            short: 'c',
            long: 'critical=<STRING>',
            desc: 'Critical threshold',
            default: 'A-'
        }
    ],
    help: 'Usage: check_ssllabs [Options]\nOptions:\n[[OPTIONS]]'
});

if(!check.param('host')) {
    check.showHelp('Host required!');
    return;
}

if(grades.indexOf( check.param('warning') ) < 0) {
    check.showHelp('Unknown warning threshold `%s`, possible values are %s', check.param('warning'), grades.join(', '));
    return;
}

if(grades.indexOf( check.param('critical') ) < 0) {
    check.showHelp('Unknown critical threshold `%s`, possible values are %s', check.param('critical'), grades.join(', '));
    return;
}

if(grades.indexOf( check.param('warning') ) >= grades.indexOf( check.param('critical') )) {
    check.showHelp('Warning threshold has to be < critical threshold…');
    return;
}


ssllabs.scan({
    host: check.param('host'),
    fromCache: true,
    maxAge: 24
}, function(err, hosts) {
    if(err) {
        check.critical(err);
        return check.send();
    }

    if(!hosts || !hosts.endpoints || hosts.endpoints.length < 1) {
        check.critical('Unknown error, API may changed?');
        return check.send();
    }

    hosts.endpoints.forEach(function(host) {
        if(grades.indexOf(host.grade) < 0) {
            check.critical('Unknown grade `%s`%s', host.grade, host.ipAddress, hosts.endpoints.length > 1 ? 'for ' + host.ipAddress : '');
        }
        else if(grades.indexOf(host.grade) < grades.indexOf( check.param('warning') )) {
            check.ok('Grade: %s :) %s', host.grade, hosts.endpoints.length > 1 ? '(' + host.ipAddress + ')' : '');
        }
        else if(grades.indexOf(host.grade) < grades.indexOf( check.param('critical') )) {
            check.warning('Grade: %s :/ %s', host.grade, hosts.endpoints.length > 1 ? '(' + host.ipAddress + ')' : '');
        }
        else {
            check.critical('Grade: %s:´( %s', host.grade, hosts.endpoints.length > 1 ? '(' + host.ipAddress + ')' : '');
        }

        if(hosts.endpoints.length === 1) {
            check.addPerfData({
                label: 'Grade',
                value: hosts.endpoints[0].grade,
                uom: '',
                min: check.param('warning')
            });
        }

        if(hosts.endpoints.length === 1 && hosts.endpoints[0].serverName) {
            check.addPerfData({
                label: 'Server',
                value: hosts.endpoints[0].serverName,
                uom: ''
            });
        }

        if(hosts.endpoints.length === 1 && hosts.endpoints[0].ipAddress) {
            check.addPerfData({
                label: 'IP Address',
                value: hosts.endpoints[0].ipAddress,
                uom: ''
            });
        }
    });

    check.send();
});
