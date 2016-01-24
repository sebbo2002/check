#!/usr/bin/env node
'use strict';

var Check = require('../check.js'),
    request = require('request'),
    ua = 'Mozilla/5.0 (check_kue) check_kue/' + require('../package.json').version + ' (https://github.com/sebbo2002/check)',
    check,
    url;

check = new Check({
    name: 'check_kue',
    arguments: [
        {
            short: 'h',
            long: 'host=<STRING>',
            desc: 'kue-URL (`https://teamcity.example.com`)'
        },
        {
            long: 'disable-http-warning',
            desc: 'Disable warning for kue instances without SSL'
        }
    ],
    help: 'Usage: check_kue [Options]\nOptions:\n[[OPTIONS]]'
});

if(!check.param('host')) {
    check.showHelp('kue-URL required!');
    return;
}

url = require('url').parse(check.param('host'));
if(url.protocol === 'http:' && !check.param('disable-http-warning')) {
    check.critical('kue access over HTTP blocked, due to security reasons. Enter a HTTPS secured address or add `disable-http-warning` to allow unsecure connections…');
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


request({
    url: require('url').format(url) + 'jobs/active/0..10/asc',
    headers: {
        'User-Agent': ua
    }
}, function(error, response, body) {
    if(error) {
        check.critical('Unknown error: %s', error);
        return check.send();
    }

    var data,
        mostRecentItem;

    try {
        data = JSON.parse(body);
    }
    catch(err) {
        check.critical('JSON error: %s', err);
        return check.send();
    }


    data.forEach(function(item) {
        if(!mostRecentItem || item.updated_at >= mostRecentItem.updated_at) {
            mostRecentItem = item;
            mostRecentItem.data = mostRecentItem.data || {};
        }
    });
    if(!mostRecentItem) {
        check.ok('Queue empty.');
        return check.send();
    }

    // updated < 10min ago
    if(mostRecentItem.updated_at && new Date().getTime() - new Date(mostRecentItem.updated_at).getTime() <= 600000) {
        check.ok('Current Job: #%s %s (%s%)', mostRecentItem.id, mostRecentItem.data.title || mostRecentItem.data.file || JSON.stringify(mostRecentItem.data), mostRecentItem.progress);
    }

    // updated < 30min ago
    else if(mostRecentItem.updated_at && new Date().getTime() - new Date(mostRecentItem.updated_at).getTime() <= 1800000) {
        check.warning('Current Job: #%s %s (%s%, last update: %s)', mostRecentItem.id, mostRecentItem.data.title || mostRecentItem.data.file || JSON.stringify(mostRecentItem.data), mostRecentItem.progress, new Date(mostRecentItem.updated_at).toString());
    }

    else {
        check.critical('Current Job: #%s %s (%s%, last update: %s)', mostRecentItem.id, mostRecentItem.data.title || mostRecentItem.data.file || JSON.stringify(mostRecentItem.data), mostRecentItem.progress, new Date(mostRecentItem.updated_at).toString());
    }

    check.send();
});