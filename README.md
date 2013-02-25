persistence
===========

Persistence is a data persistence module for [flatiron](http://flatironjs.org/).
You can use it as an alternative for
[resourceful](https://github.com/flatiron/resourceful). It uses [JSON
Schema](http://json-schema.org/) for data validation.


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

  * [pvorb](/pvorb)


License
-------

[MIT License](https://github.com/n-fuse/persistence/blob/master/LICENSE.txt)
