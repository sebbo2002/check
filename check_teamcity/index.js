#!/usr/bin/env node
'use strict';

var Check = require('../check.js'),
    request = require('request'),
    async = require('async'),
    ua = 'Mozilla/5.0 (check_teamcity) check_teamcity/' + require('../package.json').version + ' (https://github.com/sebbo2002/check)',
    url,
    tcurl,
    check;

check = new Check({
    name: 'check_teamcity',
    arguments: [
        {
            short: 'h',
            long: 'host=<STRING>',
            desc: 'TeamCity-URL (`https://teamcity.example.com`)'
        },
        {
            long: 'disable-http-warning',
            desc: 'Disable warning for TeamCity instances without SSL'
        }
    ],
    help: 'Usage: check_teamcity [Options]\nOptions:\n[[OPTIONS]]'
});

if(!check.param('host')) {
    check.showHelp('TeamCity-URL required!');
    return;
}

url = require('url').parse(check.param('host'));
if(url.protocol === 'http:' && !check.param('disable-http-warning')) {
    check.critical('TeamCity access over HTTP blocked, due to security reasons. Enter a HTTPS secured address or add `disable-http-warning` to allow unsecure connections…');
    return check.send();
}
else if(url.protocol === null && url.pathname) {
    url.protocol = 'https:';
    url.hostname = url.pathname;
    url.pathname = null;
}
else if(['http:', 'https:'].indexOf(url.protocol) < 0) {
    check.critical('Unsupported protocol `%s`!', url.protocol);
    return check.send();
}

// no auth? use user…
if(!url.auth) {
    url.auth = 'guest';
}

// TC-URL without trailing /
tcurl = require('url').format(url);
if(tcurl.substr(-1) === '/') {
    tcurl = tcurl.substr(0, tcurl.length - 1);
}

async.parallel({
    getMostRecentTeamcityVersion: function(cb) {
        request({
            url: 'https://data.services.jetbrains.com/products/releases?code=TC&latest=true&type=release',
            headers: {
                'User-Agent': ua
            },
            json: true
        }, function(error, response, body) {
            if(error) {
                check.critical('Unknown error while fetching the most recent TeamCity version: %s', error);
                return cb();
            }

            if(!body || !body.TC || !body.TC[0] || !body.TC[0].version) {
                check.warning('Unable to detect most recent TeamCity version, sorry…');
                return cb();
            }

            cb(null, body.TC[0].version);
        });
    },
    getCurrentTeamcityVersion: function(cb) {
        request({
            url: tcurl + '/httpAuth/app/rest/server',
            headers: {
                'Accept': 'application/json',
                'User-Agent': ua
            },
            json: true
        }, function(error, response, json) {
            if(error) {
                check.critical('Unknown error while fetching your TeamCity version: %s', error);
                return cb(null, {});
            }
            if(typeof json !== 'object') {
                check.critical('Unknown error while fetching your TeamCity version, is your auth data correct?');
                return cb(null, {});
            }

            var version = {
                version: json.version.split(' ')[0],
                build: json.buildNumber
            };
            cb(null, version);
        });
    },
    getNumOfConnectedAgents: function(cb) {
        request({
            url: tcurl + '/httpAuth/app/rest/agents',
            headers: {
                'Accept': 'application/json',
                'User-Agent': ua
            },
            json: true
        }, function(error, response, json) {
            if(error) {
                check.critical('Unknown error while fetching your agent data: %s', error);
                return cb(null, {});
            }
            if(typeof json !== 'object' || !json.agent) {
                check.critical('Unknown error while fetching your agent data, is your auth data correct?');
                return cb(null, {});
            }

            var jobs = [];
            json.agent.forEach(function(agent) {
                jobs.push(function(cb) {
                    request({
                        url: tcurl + '/' + agent.href.substr(1),
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': ua
                        },
                        json: true
                    }, function(error, response, json) {
                        console.log(json);
                        if(error) {
                            check.critical('Unknown error while fetching agent #%s data: %s', agent.id, error);
                            return cb(null, {});
                        }
                        if(typeof json !== 'object') {
                            check.critical('Unknown error while fetching agent #%s data, is your auth data correct?', agent.id);
                            return cb(null, {});
                        }

                        cb(null, json);
                    });
                });
            });

            async.parallel(jobs, function(e, agents) {
                var res = {
                    ready: [],
                    notReady: []
                };

                agents.forEach(function(agent) {
                    if(!agent.enabled) {
                        res.notReady.push(agent.name + ' => disabled');
                    }
                    else if(!agent.connected) {
                        check.warning('Agent %s disconnected!', agent.name);
                        res.notReady.push(agent.name + ' => disconnected');
                    }
                    else if(!agent.authorized) {
                        check.warning('Agent %s unauthorized!', agent.name);
                        res.notReady.push(agent.name + ' => unauthorized');
                    }
                    else {
                        res.ready.push(agent.name + ' => OK');
                    }
                });

                cb(null, res);
            });
        });
    }
}, function(e, res) {

    // compare version
    if(res.getMostRecentTeamcityVersion === res.getCurrentTeamcityVersion.version) {
        check.ok('Your TeamCity installation (%s, build %s) is up to date.', res.getCurrentTeamcityVersion.version, res.getCurrentTeamcityVersion.build);
    }
    else if(res.getMostRecentTeamcityVersion !== res.getCurrentTeamcityVersion.version) {
        check.warning('There are updates available (installed: %s, available: %s)', res.getCurrentTeamcityVersion.version, res.getMostRecentTeamcityVersion);
    }

    // check agents
    if(!res.getNumOfConnectedAgents || !res.getNumOfConnectedAgents.ready || res.getNumOfConnectedAgents.ready.length === 0) {
        check.critical('No healthy agents available!');
    }
    (res.getNumOfConnectedAgents.notReady || []).forEach(function(status) {
        check.warning('Agent %s', status);
    });


    check.send();
});
