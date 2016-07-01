/**
 * Created by arey on 30/05/16.
 */
var elasticsearch = require('elasticsearch'),
    elasticDeleteQuery = require('elastic-deletebyquery'),
    fs = require('fs'),
    sync = require('synchronize'),
    _ = require('lodash'),
    path = require('path'),
    colors = require('colors');

var CLI = function(options){
    this.esClient = new elasticsearch.Client({
        host: options.host + ':' + options.port
    });

    elasticDeleteQuery(this.esClient);

    //Synchronize methods
    sync(this.esClient, 'index', 'bulk', 'delete', 'deleteByQuery', 'search', 'scroll', 'getTemplate');
    sync(this.esClient.indices, 'exists', 'create', 'putMapping', 'getMapping', 'putSettings', 'close', 'open', 'putTemplate', 'deleteTemplate', 'existsTemplate', 'get');
    sync(this.esClient.snapshot, 'getRepository', 'createRepository', 'deleteRepository', 'get', 'create', 'delete', 'restore', 'status');
};

CLI.prototype.getElasticFiles = function(fileDirectory, recursive){
    var me = this,
        files = [],
        argumentStat = fs.statSync(fileDirectory);

    if( argumentStat.isFile() ){
        if( fileDirectory.endsWith('.json') ){
            files.push(fileDirectory);
        }else{
            files = [];
        }
    }else{
        fileDirectory = (fileDirectory.endsWith('/')) ? fileDirectory : fileDirectory + '/';

        //If recursive mode is active
        if(recursive){
            var filesOnPath = fs.readdirSync(fileDirectory);

            _.forEach(filesOnPath, function(file){
                var toScan = fileDirectory + file,
                    fileToAdd = me.getElasticFiles(toScan, recursive);

                if( !_.isEmpty(fileToAdd) ){
                    files = _.union(files, fileToAdd);
                }
            });
        }else{
            //Return the files on current directory
            files = fs.readdirSync(fileDirectory);

            //Filter files
            files = files.filter(function(file){
                return file.endsWith('.json');
            });

            files = files.map(function(file){
                return fileDirectory + file;
            });
        }
    }

    return files;
};

CLI.prototype.putMappings = function(fileDirectory, options){
    var me = this;

    sync.fiber(function(){
        try{
            var mappings = me.getElasticFiles(fileDirectory, options.recursive);

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
            var mappings = me.getElasticFiles(fileDirectory, options.recursive);

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
            var indexes = me.getElasticFiles(fileDirectory, options.recursive);

            indexes.forEach(function(file, index){
                var indexData = JSON.parse(fs.readFileSync(file, 'utf8'));

                if( !me.esClient.indices.exists({ index: indexData.index }) ){
                    console.log('Creating index %s'.blue, indexData.index);

                    var indexToCreate = {
                        index: indexData.index,
                        body: indexData.body
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
            var dataFiles = me.getElasticFiles(fileDirectory, options.recursive);

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
                            delete data._parent;
                        }

                        if( data._id ){
                            bulkItem.index._id = data._id;
                            delete data._id;
                        }

                        if( data.id ){
                            bulkItem.index._id = data.id;
                            delete data.id;
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
            var templates = me.getElasticFiles(fileDirectory, options.recursive);

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
    var importedDocuments = bulkDocuments.length / 2,
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

CLI.prototype.getTemplate = function(tempaltes, options){
    var me = this;

    sync.fiber(function(){
        try{
            console.log('closing index: %s'.blue, tempaltes.toString());

            if( !me.esClient.indices.exists({ index: tempaltes }) ){
                throw new Error('The index ' + tempaltes + ' doesnt exists');
            }

            var toShow;

            if( !_.isEmpty(tempaltes) ){
                toShow = tempaltes.toString();
            }else{
                toShow = '*';
            }

            var templateInfo = me.esClient.getTemplate({
                id: toShow
            });

            console.log(me.printJSON(templateInfo).yellow);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.getIndex = function(indexes, options){
    var me = this;

    sync.fiber(function(){
        try{
            console.log('closing index: %s'.blue, indexes.toString());

            if( !me.esClient.indices.exists({ index: indexes }) ){
                throw new Error('The index ' + indexes + ' doesnt exists');
            }

            var toShow;

            if( !_.isEmpty(indexes) ){
                toShow = indexes.toString();
            }else{
                toShow = '*';
            }

            var indexInfo = me.esClient.indices.get({
                index: toShow
            });

            console.log(me.printJSON(indexInfo).yellow);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.openIndex = function(indexes, options){
    var me = this;

    sync.fiber(function(){
        try{
            console.log('closing index: %s'.blue, indexes.toString());

            if( !me.esClient.indices.exists({ index: indexes }) ){
                throw new Error('The index ' + indexes + ' doesnt exists');
            }

            var toOpen;

            if( !_.isEmpty(indexes) ){
                toOpen = indexes.toString();
            }else{
                toOpen = '*';
            }

            me.esClient.indices.open({
                index: toOpen
            });

            if( !_.isEmpty(indexes) ){
                console.log('The index: %s were open'.green, indexes.toString());
            }else{
                console.log('All indexes were open'.green);
            }
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.closeIndex = function(indexes, options){
    var me = this;

    sync.fiber(function(){
        try{
            console.log('closing index: %s'.blue, indexes.toString());

            if( !me.esClient.indices.exists({ index: indexes }) ){
                throw new Error('The index ' + indexes + ' doesnt exists');
            }

            var toClose;

            if( !_.isEmpty(indexes) ){
                toClose = indexes.toString();
            }else{
                toClose = '*';
            }

            me.esClient.indices.close({
                index: toClose
            });

            if( !_.isEmpty(indexes) ){
                console.log('The index: %s were close'.green, indexes.toString());
            }else{
                console.log('All indexes were close'.green);
            }
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

CLI.prototype.deleteAll = function(index, type){
    var me = this;

    sync.fiber(function(){
        try{
            console.log('Deleting elements from type %s on index %s'.blue, type, index);

            if( !me.esClient.indices.exists({ index: index }) ){
                throw new Error('The index ' + index + ' doesnt exists');
            }

            var response = me.esClient.deleteByQuery({
                index: index,
                type: type
            });

            console.log('The type %s was deleted correctly from %s (%s elements)'.green, type, index, response.elements.length);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.extract = function(index, type, output, size, scrollTime, overrideFile, preventCopyId){
    var me = this,
        dataGeneration = {
            index: index,
            type: type,
            records: []
        };

    sync.fiber(function(){
        try{
            console.log('Extracting elements with bulk size %s from type %s on index %s. Prevent Id = %s'.blue, size, type, index, preventCopyId);

            if( !me.esClient.indices.exists({ index: index }) ){
                throw new Error('The index ' + index + ' doesnt exists');
            }

            var response = me.esClient.search({
                index: index,
                type: type,
                scroll: scrollTime + 's',
                size: size
            });

            if(_.isEmpty(response.hits.hits)){
                throw new Error('No elements found');
            }

            var totalElements = response.hits.total;

            //Add elements to records
            while (totalElements !== dataGeneration.records.length) {
                //Map the source, add the id
                var elements = _(response.hits.hits).map(function(element){
                    if(!preventCopyId){
                        var id = element._id;
                        element._source._id = id;
                    }
                    if(element._parent){
                        element._source._parent = element._parent;
                    }
                    return element._source;
                }).value();

                //Add the elements to the records
                dataGeneration.records = _.union(dataGeneration.records, elements);

                response = me.esClient.scroll({
                    scrollId: response._scroll_id,
                    scroll: scrollTime + 's'
                });
            }

            if( fs.existsSync(output) && !overrideFile ){
                console.log('File %s already exists, aborting'.red, output);
                return;
            }

            console.log('Creating file %s. It would have %s extracted'.blue, output, dataGeneration.records.length);

            fs.writeFileSync(output, JSON.stringify(dataGeneration));

            console.log('File %s created successfully'.green, output);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.getRepository = function(repoName){
    var me = this;

    sync.fiber(function(){
        try{
            var repository = (repoName) ? repoName : '*';

            var repo = me.esClient.snapshot.getRepository({
                repository: repository
            });

            console.log(me.printJSON(repo).yellow);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.createRepository = function(fileOrPath, options){
    var me = this;

    sync.fiber(function(){
        try{
            if(options.use_path) {
                me.esClient.snapshot.createRepository({
                    repository: options.name,
                    body: {
                        type: 'fs',
                        settings: {
                            compress: true,
                            location: fileOrPath
                        }
                    }
                });
            }else{
                var dataFiles = me.getElasticFiles(fileOrPath, options.recursive);

                dataFiles.forEach(function(file, index){
                    var dataSet = JSON.parse(fs.readFileSync(file, 'utf8'));

                    me.esClient.snapshot.createRepository({
                        repository: dataSet.repository,
                        body: dataSet.body
                    });
                });
            }

            console.log('Repository created'.green);
        }catch(e){
            console.log('You need to have the same directory in the repo path on the configuration file (/etc/elasticsearch/elasticsearch.yml)\nExample: path.repo: /backup/es_backup_basic\n'.blue);
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.deleteRepository = function(repoName){
    var me = this;

    sync.fiber(function(){
        try{
            me.esClient.snapshot.deleteRepository({
                repository: repoName
            });

            console.log(('Repository ' + repoName + ' deleted').green);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.getSnapshot = function(repoName, snapshotName){
    var me = this;

    sync.fiber(function(){
        try{
            var toSend = {
                repository: repoName
            };

            if(snapshotName){
                toSend.snapshot = snapshotName;
            }else{
                toSend.snapshot = '*';
            }

            var snapshots = me.esClient.snapshot.get(toSend);

            console.log(me.printJSON(snapshots).yellow);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.createSnapshot = function(repoName, snapshotName, indexesRequired, waitForCompletion){
    var me = this;

    sync.fiber(function(){
        try{
            if(waitForCompletion){
                console.log('Creating snapshot, please wait...'.blue);
            }

            var toCreate = {
                repository: repoName,
                snapshot: snapshotName,
                waitForCompletion: waitForCompletion
            };

            if( !_.isEmpty(indexesRequired) ){
                toCreate.body = {
                    indices: indexesRequired.toString()
                };
            }

            me.esClient.snapshot.create(toCreate);

            console.log(('Snapshot ' + snapshotName + ' created on ' + repoName).green);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.removeSnapshot = function(repoName, snapshotName){
    var me = this;

    sync.fiber(function(){
        try{
            me.esClient.snapshot.delete({
                repository: repoName,
                snapshot: snapshotName
            });

            console.log(('Snapshot ' + snapshotName + ' removed from ' + repoName).green);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.restoreSnapshot = function(repoName, snapshotName, waitForCompletion){
    var me = this;

    sync.fiber(function(){
        try{
            if(waitForCompletion){
                console.log('Restoring snapshot, please wait...'.blue);
            }

            var toRestore = {
                repository: repoName,
                snapshot: snapshotName,
                waitForCompletion: waitForCompletion
            };

            me.esClient.snapshot.restore(toRestore);

            console.log(('Snapshot ' + snapshotName + ' restore').green);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.statusSnapshot = function(repoName, snapshotName, waitForCompletion){
    var me = this;

    sync.fiber(function(){
        try{
            if(waitForCompletion){
                console.log('Restoring snapshot, please wait...'.blue);
            }

            var toRestore = {
                repository: repoName,
                snapshot: snapshotName
            };

            var status = me.esClient.snapshot.status(toRestore);

            console.log(me.printJSON(status).yellow);
        }catch(e){
            console.log('An error has ocurred: %s'.red, e.message);
        }
    });
};

CLI.prototype.printJSON = function(obj){
    return JSON.stringify(obj, null, 2);
};

module.exports = CLI;