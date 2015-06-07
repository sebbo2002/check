'use strict';

/**
 * @author Sebastian Pekarek
 * @module check
 * @constructor Check Check
 */
var Check = function Check(options) {
    var Plugin = require('nagios-plugin'),
        util = require('util'),
        check = this,
        nagios = new Plugin({shortName: options.name}),
        argDefaults = {},
        args,
        opt,
        state;

    /**
     * @param {Object[]} newArgs parameter
     * @returns {Check}
     */
    this.setArguments = function(newArgs) {
        if(opt) {
            throw 'Arguments already set…';
        }

        var getoptParams = [];
        newArgs.forEach(function(argument) {
            argDefaults[ argument.long.split('=')[0] ] = argument.default || null;

            getoptParams.push([
                argument.short || null,
                argument.long,
                argument.desc
            ]);
        });
        getoptParams.push([null, 'help', 'display this help']);
        opt = require('node-getopt').create(getoptParams);

        return check;
    };

    /**
     * @param {String} message Message
     * @returns {Check}
     */
    this.setHelp = function(message) {
        opt.bindHelp();
        opt.setHelp(message);

        return check;
    };


    /**
     * @param {String} key parameter name
     * @returns {String|null} value
     */
    this.param = function(key) {
        if(!args) {
            args = opt.parseSystem();
        }

        return args.options[key] || argDefaults[key] || null;
    };


    this.showHelp = function() {
        console.log('\n## sebbo2002/' + options.name + '\n');

        if(arguments.length) {
            console.error('### Oh oh: :/');
            process.stdout.write('    ');
            console.error.apply(console.log, arguments);
            console.log('');
        }
        opt.showHelp();
        process.exit(3);
    };


    /**
     * @param {object} p Performance data
     * @returns {Check}
     */
    this.addPerfData = function(p) {
        nagios.addPerfData(p);
        return check;
    };


    this.ok = function() {
        nagios.addMessage(nagios.states.OK, util.format.apply(util.format, arguments));
    };

    this.warning = function() {
        nagios.addMessage(nagios.states.WARNING, util.format.apply(util.format, arguments));
    };

    this.critical = function() {
        nagios.addMessage(nagios.states.CRITICAL, util.format.apply(util.format, arguments));
    };

    this.send = function() {
        var messageObj = nagios.checkMessages();
        nagios.nagiosExit(messageObj.state, messageObj.message);
    };



    this.setArguments(options.arguments);
    if(opt && options && options.help) {
        this.setHelp(options.help);
    }
};

module.exports = Check;
