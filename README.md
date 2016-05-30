# Elasticsearch Commander Tool

This is a Elasticsearch tool made with [commander](https://www.npmjs.com/package/commander) for making basic operations

- Creating Index (One File or Multiple Files)
- Creating Types - Mappings (One File or Multiple Files)
- Auto detect changes on Type / Mapping file structure
- Creating Templates (One File or Multiple Files)
- Delete Index
- Delete Template
- Delete Type by ID

## Installation

You need to install this package globally

```
npm install -g elastic-tool
```

## Basic Information

For all the commands that recieves *<file/folder>* you can pass eathier a file or a folder. If you pass a file, you only going to apply the changes for that file only. If you pass a directory, the application is going to apply the changes for all the files on that directory

```
elastic put-index /test/directory/file.json
```

or

```
elastic put-index /test/directory
```

The */* at the end is not mandatory

## Indexes File Format

```json
{
  "index": "example",
  "body": {
    "index": {
      "analysis": {
        "analyzer": {
          "sortable": {
            "type": "custom",
            "tokenizer": "keyword",
            "filter": ["lowercase"]
          },
          "path_hierarchy": {
            "type": "custom",
            "tokenizer": "path_hierarchy",
            "filter": ["lowercase"]
          }
        }
      }
    }
  }
}
```

The body content is the body from the Official API of Elasticsearch

## Mapping File Format
### put-mappings

This command will always create the mapping

```json
{
	"index": "example",
	"type": "users",
	"body": {
		"users": {
			"properties": {
				"firstname": { "type": "string" },
				"lastname": { "type": "string" }
			}
		}
	}
}
```

The body content is the body from the Official API of Elasticsearch

### auto-mappings

This command will automatically detect the changes and *putMapping* of the properties that are not currently on the ES Type

```json
{
	"index": "example",
	"type": "users",
	"body": {
		"users": {
			"properties": {
				"firstname": { "type": "string" },
				"lastname": { "type": "string" },
				"phone": { "type": "string" }
			}
		}
	}
}
```

This will *putMapping* only the *phone* property

The body content is the body from the Official API of Elasticsearch

## Templates File Format

```json
{
  "template": "template-*",
  "order": 0,
  "body": {
    "settings" : {
      "index" : {
        "number_of_shards" : 5,
        "number_of_replicas": 0
      }
    },
    "mappings": {
      "search": {
        "_all" : { "enabled" : false },
        "_timestamp": {
          "enabled": true,
          "path": "@timestamp",
          "store": true
        },
        "dynamic": false,
        "properties": {
          "@timestamp": { "type": "date"},
          "site": { "type": "string", "index": "not_analyzed"},
          "request": {
            "type": "object",
            "dynamic": false,
            "properties": {
              "request_id": { "type": "string", "index": "not_analyzed"},
              "session_id": { "type": "string", "index": "not_analyzed"},
              "user_agent": {"type": "object", "dynamic": false },
              "url": { "type": "string", "index": "not_analyzed"},
              "utm_source": { "type": "string", "index": "not_analyzed"},
              "utm_medium": { "type": "string", "index": "not_analyzed"},
              "query": {"type": "object", "dynamic": false },
              "referer": {
                "type": "object",
                "dynamic": false,
                "properties": {
                  "url": { "type": "string", "index": "not_analyzed"},
                  "intra_site": { "type":"boolean" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Insert data

This command will insert data into de database

```json
{
  "index": "example",
  "type": "users",
  "records": [
    {
      "firstname": "Ariel",
      "lastname": "Rey"
    },
    {
      "id": "Juan",
      "title": "Perez"
    }
  ]
}
```

You can also reference *_parent* property

```json
{
  "index": "example",
  "type": "users",
  "records": [
    {
      "_parent": 1,
      "firstname": "Ariel",
      "lastname": "Rey"
    },
    {
      "_parent": 2,
      "id": "Juan",
      "title": "Perez"
    }
  ]
}
```

In records, you will put the body content is the body from the Official API of Elasticsearch

## Example

You will find some examples on the example folder for each case

## License
```
The MIT License (MIT)

Copyright (c) <2015> <Ariel Rey>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```