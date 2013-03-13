Restposten
==========

Restposten is a data persistence module for [flatiron](http://flatironjs.org/).
It's an adaptation of [resourceful](https://github.com/flatiron/resourceful).
You can replace resourceful in your flatiron app by Restposten. It uses [JSON
Schema](http://json-schema.org/) for data validation. It also has support for
JSON Schema links, which are directly mapped to relations in the internal data
model. Being a replacement for resourceful you can use it with
[restful](https://github.com/flatiron/restful), too.


Installation
------------

    npm install restposten

You also have to provide a database engine, a cache and a JSON Schema validator.

Currently, there are two database engines:
[restposten-mongodb](https://github.com/n-fuse/restposten-mongodb) and
[restposten-memory](https://github.com/n-fuse/restposten-memory) (a in-memory
database for testing purposes).

    npm install restposten-mongodb

or

    npm install restposten-memory

The recommended schema validator is
[JaySchema](https://github.com/natesilva/jayschema).

    npm install jayschema


API documentation
-----------------

You can find the API docs at <http://n-fuse.github.com/restposten/>.


Usage
-----

### Simple example

This example uses _restposten-mongodb_ and _JaySchema_.

    var restposten = require('restposten');
    var mongo = require('restposten-mongodb');
    var JaySchema = require('jayschema');
    
    restposten.validator = new JaySchema();
    
    mongo.connect({ host: 'localhost', port: 27017 }, function (err, db) {
      if (err)
        throw err;

      restposten.database = db;
    
      // Example schema
      var userSchema = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "id": "http://example.org/api/v1/user.schema.json",
        "title": "user",
        "description": "System user",
        "required": [ "id", "email" ],
        "properties": {
          "_id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "email": {
            "type": "string",
            "format": "email"
          }
        }
      };
    
      // Register a schema for validation.
      // This is only required, if you have schemas that reference each other.
      restposten.validator.register(userSchema);
    
      // Define the User resource.
      var User = restposten.define('user', userSchema);
    
      // Create a user, who's missing an email address. This will throw an error.
      User.create({
        "_id": "pvorb",
        "name": "Paul Vorbach"
      }, function (err, u1) {
        if (err)
          throw err;
    
        console.log(u1);
      });
    });

See [the JSON Schema specification](http://json-schema.org) for more advanced
examples and further documentation on JSON Schema.


### More advanced examples

You can see more advanced examples in [examples/](https://github.com/n-fuse/restposten/tree/master/examples/).


Maintainers
-----------

  * [pvorb](https://github.com/pvorb)


License
-------

[MIT License](https://github.com/n-fuse/restposten/tree/master/LICENSE.txt)
