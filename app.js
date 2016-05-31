#!/usr/bin/env node

'use strict';

var pkg = require('./package.json'),
    program = require('commander'),
    CLI = require('./lib/CLI');

program.version(pkg.version)
    .option('-v, --version', 'get version');

program
    .command('put-mappings <file/folder>')
    .description('Put mappings on elasticsearch index specified on file')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .option('-f --force [force]', 'force the index creation', false)
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putMappings(fileDirectory, { force: commander.force });
    });

program
    .command('auto-mappings <file/folder>')
    .description('Put mappings on elasticsearch with auto detect changes')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .option('-f --force [force]', 'force the index creation', false)
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.autoMappings(fileDirectory, { force: commander.force });
    });

program
    .command('put-index <file/folder>')
    .description('Put indexes on elasticsearch')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putIndex(fileDirectory, {});
    });

program
    .command('put-data <file/folder>')
    .description('Put data into a elastic type')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putData(fileDirectory, {});
    });

program
    .command('put-template <file/folder>')
    .description('Create elasticsearch templates')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putTemplate(fileDirectory, {});
    });

program
    .command('delete-template [name]')
    .description('delete specific template')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .action(function(template, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.deleteTemplate(template, {});
    });

program
    .command('delete-index [name]')
    .description('delete specific index')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .action(function(index, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.deleteIndex(index, {});
    });

program
    .command('delete-by-id [index] [type] [id]')
    .description('delete specific index')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .action(function(index, type, id, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        if(index === undefined || type === undefined || id === undefined){
            console.log('All the parameters must be input'.red);
        }

        CLI.deleteById(index, type, id);
    });

if (!process.argv.slice(2).length) {
    program.outputHelp();
}

program.parse(process.argv);
