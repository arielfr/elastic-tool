/**
 * Created by arey on 30/05/16.
 */
var elasticsearch = require('elasticsearch'),
    fs = require('fs'),
    sync = require('synchronize'),
    _ = require('lodash'),
    path = require('path'),
    colors = require('colors');

var CLI = function(options){
    this.esClient = new elasticsearch.Client({
        host: options.host + ':' + options.port
    });

    //Synchronize methods
    sync(this.esClient.indices, 'exists', 'create', 'putMapping', 'getMapping', 'putSettings', 'close', 'open', 'putTemplate', 'deleteTemplate', 'existsTemplate');
    sync(this.esClient, 'index', 'bulk', 'delete');
};

CLI.prototype.getElasticFiles = function(fileDirectory){
    var files = [],
        argumentStat = fs.statSync(fileDirectory);

    if( argumentStat.isFile() ){
        files.push(fileDirectory);
    }else{
        fileDirectory = (fileDirectory.endsWith('/')) ? fileDirectory : fileDirectory + '/';

        files = fs.readdirSync(fileDirectory);

        //Filter files
        files = files.filter(function(file){
            return file.endsWith('.json');
        });

        files = files.map(function(file){
            return fileDirectory + file;
        });
    }

    return files;
};

CLI.prototype.putMappings = function(fileDirectory, options){
    var me = this;

    sync.fiber(function(){
        try{
            var mappings = me.getElasticFiles(fileDirectory);

            mappings.forEach(function(file, index){
                var mapping = JSON.parse(fs.readFileSync(file, 'utf8'));

                if( !me.esClient.indices.exists({ index: mapping.index }) ){
                    if( options.force ){
                        console.log('Creating index %s'.blue, mapping.index);

                        var indexToCreate = {
                            index: mapping.index
                        };

                        //Add specific params not in body
                        ['timeout', 'masterTimeout', 'updateAllTypes'].forEach(function(param, index){
                            if(indexToCreate[param]){
                                indexToCreate[param] = indexToCreate[param];
                            }
                        });

                        me.esClient.indices.create(indexToCreate);

                        console.log('Index %s created successfully'.green, mapping.index);
                    }else{
                        throw new Error('The index ' + mapping.index + ' doesnt exists, use --force to force the creation');
                    }
                }

                me.esClient.indices.putMapping({
                    index: mapping.index,
                    type: mapping.type,
                    ignoreConflicts: true,
                    body: mapping.body
                });

                console.log('The mapping %s was created successfully'.green, mapping.type);
            });
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.autoMappings = function(fileDirectory, options){
    var me = this;

    sync.fiber(function(){
        try{
            var mappings = me.getElasticFiles(fileDirectory);

            var change = 0;

            mappings.forEach(function(file, index){
                var mapping = JSON.parse(fs.readFileSync(file, 'utf8'));

                if( !me.esClient.indices.exists({ index: mapping.index }) ){
                    if( options.force ){
                        console.log('Creating index %s'.blue, mapping.index);

                        var indexToCreate = {
                            index: mapping.index
                        };

                        //Add specific params not in body
                        ['timeout', 'masterTimeout', 'updateAllTypes'].forEach(function(param, index){
                            if(indexToCreate[param]){
                                indexToCreate[param] = indexToCreate[param];
                            }
                        });

                        me.esClient.indices.create(indexToCreate);

                        console.log('Index %s created successfully'.green, mapping.index);
                    }else{
                        throw new Error('The index ' + mapping.index + ' doesnt exists, use --force to force the creation');
                    }
                }

                var result = me.esClient.indices.getMapping({
                    index: mapping.index,
                    type: mapping.type
                });

                if( result[mapping.index] ){
                    var index = result[mapping.index],
                        properties = index.mappings[mapping.type]['properties'],
                        toUpdate = {};

                    console.log('Checking %s/%s'.blue, mapping.index, mapping.type);

                    //Update the other tags
                    _.forEach(mapping.body[mapping.type], function(value, key){
                        if(key != 'properties'){
                            var upsert = false;

                            if(!index.mappings[mapping.type][key]){
                                upsert = true;
                            }else{
                                upsert = me.checkChilds(value, index.mappings[mapping.type][key]);
                            }

                            if( upsert ){
                                toUpdate[key] = value;
                            }
                        }
                    });

                    //Check for new properties (Do not update mappings to prevent future errors)
                    var missingProperties = _.difference(_.keys(mapping.body[mapping.type]['properties']), _.keys(properties));

                    if(missingProperties.length > 0){
                        toUpdate['properties'] = {};
                    }

                    _.forEach(missingProperties, function(value, key){
                        toUpdate['properties'][value] = mapping.body[mapping.type]['properties'][value];
                    });

                    //Updating the mapping if it is necessary
                    if(_.size(toUpdate) > 0){
                        me.esClient.indices.putMapping(
                            {
                                index: mapping.index,
                                type: mapping.type,
                                ignoreConflicts: true,
                                body: toUpdate
                            }
                        );

                        console.log('Updating %s/%s'.green, mapping.index, mapping.type);

                        change++;
                    }else{
                        console.log('No changes on %s/%s'.yellow, mapping.index, mapping.type);
                    }
                }else{
                    me.esClient.indices.putMapping({
                        index: mapping.index,
                        type: mapping.type,
                        ignoreConflicts: true,
                        body: mapping.body
                    });

                    change++;

                    console.log('The mapping %s was created successfully'.green, mapping.type);
                }

                console.log('Mappings updated or created %s/%s'.green, change, mappings.length);
            });
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.checkChilds = function(fromFile, fromDB){
    var upsert = false;

    if(typeof fromDB != 'undefined'){
        if(typeof fromFile === 'object'){
            _.forEach(_.keys(fromFile), function(key){
                if(!upsert){
                    upsert = checkChilds(fromFile[key], fromDB[key]);
                }
            });
        }else{
            return !(fromFile.toString() === fromDB.toString());
        }
    }else{
        return true;
    }

    return upsert;
};

CLI.prototype.putIndex = function(fileDirectory, options){
    var me = this;

    sync.fiber(function(){
        try{
            var indexes = me.getElasticFiles(fileDirectory);

            indexes.forEach(function(file, index){
                var indexData = JSON.parse(fs.readFileSync(file, 'utf8'));

                if( !me.esClient.indices.exists({ index: indexData.index }) ){
                    console.log('Creating index %s'.blue, indexData.index);

                    var indexToCreate = {
                        index: indexData.index
                    };

                    //Add specific params not in body
                    ['timeout', 'masterTimeout', 'updateAllTypes'].forEach(function(param, index){
                        if(indexToCreate[param]){
                            indexToCreate[param] = indexToCreate[param];
                        }
                    });

                    me.esClient.indices.create(indexToCreate);

                    console.log('Index %s created successfully'.green, indexData.index);
                }else{
                    me.esClient.indices.close({ index: indexData.index });

                    console.log('The index %s already exists. Updating settings'.blue, indexData.index);

                    var indexToUpdate = {
                        index: indexData.index,
                        body: indexData.body
                    };

                    //Add specific params not in body
                    ['timeout', 'masterTimeout', 'updateAllTypes'].forEach(function(param, index){
                        if(indexToUpdate[param]){
                            indexToUpdate[param] = indexToUpdate[param];
                        }
                    });

                    me.esClient.indices.putSettings(indexToUpdate);

                    me.esClient.indices.open({ index: indexData.index });

                    console.log('The index %s was updated'.green, indexData.index);
                }
            });
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.putData = function(fileDirectory, options){
    var me = this;

    sync.fiber(function(){
        try{
            var dataFiles = me.getElasticFiles(fileDirectory);

            dataFiles.forEach(function(file, index){
                var dataSet = JSON.parse(fs.readFileSync(file, 'utf8'));

                if( !me.esClient.indices.exists({ index: dataSet.index }) ){
                    console.log('The index %s doesnt exists, cant import data'.red, dataSet.index);
                    return false;
                }else{
                    var bulkDocuments = [];

                    dataSet.records.forEach(function(data, index){
                        if (index % 1000 == 0 && bulkDocuments.length > 0) {
                            me.executeBulk(bulkDocuments, dataSet.type);
                            bulkDocuments = [];
                        }

                        var bulkItem = {
                            index: {
                                _index: dataSet.index,
                                _type: dataSet.type
                            }
                        };

                        if( data._parent ){
                            bulkItem.index._parent = data._parent;
                        }

                        bulkDocuments.push(bulkItem);
                        bulkDocuments.push(data);
                    });

                    if( bulkDocuments.length > 0 ){
                        me.executeBulk(bulkDocuments, dataSet.type);
                    }
                }
            });
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.putTemplate = function(fileDirectory, options){
    var me = this;

    sync.fiber(function(){
        try{
            var templates = me.getElasticFiles(fileDirectory);

            templates.forEach(function(file, index){
                var templateData = JSON.parse(fs.readFileSync(file, 'utf8'));

                if( !me.esClient.indices.existsTemplate({ name: templateData.template }) ){
                    console.log('Creating the template %s'.blue, templateData.template);

                    //Add the template to the body
                    templateData.body['template'] = templateData.template;

                    var templateToPut = {
                        name: templateData.template,
                        body: templateData.body
                    };

                    //Add specific params not in body
                    ['order', 'craete', 'timeout', 'masterTimeout', 'flatSettings'].forEach(function(param, index){
                        if(templateData[param]){
                            templateToPut[param] = templateData[param];
                        }
                    });

                    me.esClient.indices.putTemplate(templateToPut);

                    console.log('Template %s created'.green, templateData.template);
                }else{
                    console.log('The template %s already exists'.yellow, templateData.template);
                }
            });
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.executeBulk = function(bulkDocuments, type){
    var importedDocuments = bulkDocuments.length,
        bulkResult = this.esClient.bulk({ body: bulkDocuments });

    if( bulkResult.errors ){
        console.log('An error ocurred importing the data: %s'.red, bulkResult.errors);
    }

    console.log('Imported %s documents to the type %s'.green, importedDocuments, type);
};

CLI.prototype.deleteTemplate = function(template, options){
    var me = this;

    sync.fiber(function(){
        try{
            console.log('Deleting template %s'.blue, template);

            if( !me.esClient.indices.existsTemplate({ name: template }) ){
                throw new Error('The template ' + template + ' doesnt exists');
            }

            me.esClient.indices.deleteTemplate({
                name: template
            });

            console.log('The template %s was deleted correctly'.green, template);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.deleteIndex = function(index, options){
    var me = this;

    sync.fiber(function(){
        try{
            if( index == '*' || index == '_all' ){
                throw new Error('Operation ' + index + ' is not permitted');
            }

            console.log('Deleting index %s'.blue, index);

            if( !me.esClient.indices.exists({ index: index }) ){
                throw new Error('The index ' + index + ' doesnt exists');
            }

            me.esClient.indices.delete({
                index: index
            });

            console.log('The index %s was deleted correctly'.green, index);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.deleteById = function(index, type, id){
    var me = this;

    sync.fiber(function(){
        try{
            console.log('Deleting element %s -> %s -> %s'.blue, index, type, id);

            if( !me.esClient.indices.exists({ index: index }) ){
                throw new Error('The index ' + index + ' doesnt exists');
            }

            me.esClient.delete({
                index: index,
                type: type,
                id: id
            });

            console.log('The element %s was deleted correctly from %s -> %s'.green, id, index, type);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

module.exports = CLI;