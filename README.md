persistence
===========

Persistence is a data persistence module for [flatiron](http://flatironjs.org/).
It's an adaptation of [resourceful](https://github.com/flatiron/resourceful)
and is intended to be used as a replacement for Resourceful. It uses [JSON
Schema](http://json-schema.org/) for data validation. It also has support for
JSON links, which are directly mapped to relations in the internal data model.


Installation
------------

    npm install persistence


Usage
-----

### Simple example

``` javascript
var persistence = require('persistence');

// Use MongoDB as the persistence engine.
persistence.useEngine('mongodb');

// Example schema
var userSchema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "id": "http://example.org/api/v1/user.schema.json",
  "title": "user",
  "description": "System user",
  "required": [ "id", "email" ],
  "properties": {
    "id": {
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
persistence.validator.register(userSchema);

// Define the User resource.
var User = persistence.define('user', userSchema);

// Create a user, who's missing an email address.
User.create({
  "id": "pvorb",
  "name": "Paul Vorbach"
}, function (err, u1) {
  if (err)
    throw err;

  console.log(u1);
});
```

See [the JSON Schema specification](http://json-schema.org) for more advanced
examples and further documentation on JSON Schema.


Maintainers
-----------

  * [pvorb](https://github.com/pvorb)


License
-------

[Apache 2.0 License](LICENSE.txt)
