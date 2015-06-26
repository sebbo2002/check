#!/usr/bin/env node
'use strict';

var Check = require('../check.js'),
    request = require('request'),
    async = require('async'),
    ua = 'Mozilla/5.0 (check_teamcity) check_teamcity/' + require('../package.json').version + ' (https://github.com/sebbo2002/check)',
    url,
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

async.parallel({
    getMostRecentTeamcityVersion: function(cb) {
        request({
            url: 'https://www.jetbrains.com/js2/version.js',
            headers: {
                'User-Agent': ua
            }
        }, function(error, response, body) {
            if(error) {
                check.critical('Unknown error while fetching the most recent TeamCity version: %s', error);
                return cb();
            }

            var res = body.match(/versionTCLong\s=\s["|']([0-9.]+)["|'];/i);
            if(!res) {
                check.warning('Unable to detect most recent TeamCity version, sorry…');
                return cb();
            }

            cb(null, res[1]);
        });
    },
    getCurrentTeamcityVersion: function(cb) {
        request({
            url: require('url').format(url) + '/httpAuth/app/rest/server',
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
            url: require('url').format(url) + '/httpAuth/app/rest/agents',
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
                        url: require('url').format(url) + agent.href,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': ua
                        },
                        json: true
                    }, function(error, response, json) {
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
                    else if(!agent.uptodate) {
                        check.warning('Agent %s out of date!', agent.name);
                        res.notReady.push(agent.name + ' => out of date');
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
        check.ok('There are updates available (installed: %s, available: %s)', res.getCurrentTeamcityVersion.version, res.getMostRecentTeamcityVersion);
    }

    // check agents
    if(res.getNumOfConnectedAgents.ready.length === 0) {
        check.critical('No healthy agents available!');
    }
    res.getNumOfConnectedAgents.notReady.forEach(function(status) {
        check.warning('Agent %s', status);
    });


    check.send();
});
