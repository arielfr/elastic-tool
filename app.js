#!/usr/bin/env node

'use strict';

var pkg = require('./package.json'),
    program = require('commander'),
    CLI = require('./lib/CLI');

program.version(pkg.version)
    .option('-v, --version', 'get version');

program
    .command('put-mappings <file/folder>')
    .description('Put mappings on elasticsearch index specified on file [-h -p -f -r]')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .option('-f --force [force]', 'force the index creation', false)
    .option('-r --recursive', 'scan directory recursive')
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putMappings(fileDirectory, { force: commander.force, recursive: ((commander.recursive) ? true : false) ? true : false });
    });

program
    .command('auto-mappings <file/folder>')
    .description('Put mappings on elasticsearch with auto detect changes [-h -p -f -r]')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .option('-f --force [force]', 'force the index creation', false)
    .option('-r --recursive', 'scan directory recursive', false)
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.autoMappings(fileDirectory, { force: commander.force, recursive: (commander.recursive) ? true : false });
    });

program
    .command('put-index <file/folder>')
    .description('Put indexes on elasticsearch [-h -p -r]')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .option('-r --recursive', 'scan directory recursive', false)
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putIndex(fileDirectory, { recursive: (commander.recursive) ? true : false });
    });

program
    .command('put-data <file/folder>')
    .description('Put data into a elastic type [-h -p -r]')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .option('-r --recursive', 'scan directory recursive', false)
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putData(fileDirectory, { recursive: (commander.recursive) ? true : false });
    });

program
    .command('put-template <file/folder>')
    .description('Create elasticsearch templates [-h -p -r]')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .option('-r --recursive', 'scan directory recursive', false)
    .action(function(fileDirectory, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        CLI.putTemplate(fileDirectory, { recursive: (commander.recursive) ? true : false });
    });

program
    .command('delete-template [name]')
    .description('delete specific template [-h -p]')
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
    .description('delete specific index [-h -p]')
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
    .description('delete specific type element by id [-h -p]')
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

program
    .command('delete-all [index] [type]')
    .description('delete all the data in an specific type [-h -p]')
    .option('-h, --host [host]', 'specified host', 'localhost')
    .option('-p --port [port]', 'specified port', '9200')
    .action(function(index, type, commander){
        CLI = new CLI({
            host: commander.host,
            port: commander.port
        });

        if(index === undefined || type === undefined){
            console.log('All the parameters must be input'.red);
            return;
        }

        CLI.deleteAll(index, type);
    });

if (!process.argv.slice(2).length) {
    program.outputHelp();
}

program.parse(process.argv);