'use strict';

/**
 * restposten is a data restposten module for flatiron. It's an adaptation of
 * resourceful and is intended to be used as a replacement for Resourceful. It
 * uses JSON Schema for data validation. It also has support for JSON Schema
 * links, which are directly mapped to relations in the internal data model.
 * 
 * @module restposten
 */

var events = require('events');
var clone = require('clone');
var append = require('append');
var errs = require('errs');
var inflection = require('i')();
var pluralize = inflection.pluralize;
var camelize = inflection.camelize;
var errors = require('./errors.js');

exports.resources = {};
exports.deferredRelations = {};
exports.database;
exports.validator;
exports.commonSchemas = {};

/**
 * Registers a resource.
 * 
 * @param {String}
 *                name
 * @param {Resource}
 *                resource
 */
exports.register = function(name, resource) {
  exports.resources[name] = resource;
};

/**
 * Unregisters a resource.
 * 
 * @param {String}
 *                name
 */
exports.unregister = function(name) {
  delete this.resources[name];
};

/**
 * Registers a schema for common use.
 */
exports.registerCommonSchema = function(schema) {
  if (typeof schema.id != 'undefined') {
    exports.commonSchemas[schema.id] = schema;
    if (typeof exports.validator != 'undefined')
      exports.validator.register(schema);
  }
};

/**
 * Defines a new schema factory for creating instances of schemas.
 * 
 * @param {String}
 *                name lower case singular name of the schema (e.g. `'address'`)
 * @param {Object}
 *                schema JSON schema object
 * 
 * @returns factory function for creating new instances
 */
exports.define = function(name, schema) {
  // register schema
  exports.registerCommonSchema(schema);
  
  var resource = new Resource(name, schema);
  
  // register resource
  exports.register(name, resource);

  // check if any deferred relationships from previously defined resources are
  // related to this resource
  if (typeof exports.deferredRelations[name] != 'undefined') {
    // for every deferredRelationship we find for our current resource, resolve
    // it
    exports.deferredRelations[name].forEach(function(r) {
      resolveRelations(r.resource);
    });
  }

  // resolve the relations for the newly created resource
  resolveRelations(resource);
  resource.init();

  return resource;
};

/**
 * Resolves the relations for a resource.
 * 
 * @param {Resource}
 *                resource
 * 
 * @private
 */
function resolveRelations(resource) {
  var props = resource.schema.properties;

  // go through the schema's properties and check for links with "rel": "full"
  Object.keys(props).forEach(function (key) {
    var property = props[key];
    if (typeof property.links == 'undefined')
      return;

    var links = property.links;
    var len = links.length;
    var link;
    for (var i = 0; i < len; i++) {
      link = links[i];
      if (link.rel === 'full')
        foreignKey(resource, key, link.href);
    }
  });
}

/**
 * Creates a foreign key relationship. (One-To-Many)
 * 
 * @param {Resource}
 *                from
 * 
 * @private
 */
function foreignKey(from, propertyName, href) {
  var components = href.split('/');

  // this method will only work for standard values like href = 'author/{@}'
  if (components.length != 2 && components[1] !== "{@}")
    return;

  var otherResourceName = components[0];

  // if other schema is not yet defined, defer relationship
  if (typeof exports.resources[otherResourceName] == 'undefined') {
    var rel = {
      name: from.name,
      resource: from,
      property: propertyName
    };

    if (typeof exports.deferredRelations[otherResourceName] == 'undefined')
      exports.deferredRelations[otherResourceName] = [];

    exports.deferredRelations[otherResourceName].push(rel);

    return;
  }

  var getAll = 'get' + camelize(pluralize(from.name));

  // define function to get the referenced collection
  // e.g. getBooks()
  var other = exports.resources[otherResourceName];
  other.Instance.prototype[getAll] = function(callback) {
    var query = {};
    query[propertyName] = this.properties._id;
    from.get(query, callback);
  };

  var getOne = 'get' + camelize(otherResourceName);

  // define function to get the referenced document
  // e.g. getAuthor()
  from.Instance.prototype[getOne] = function(callback) {
    other.getOne(this.properties[propertyName], callback);
  }
}

/**
 * Creates a resource with a name and a schema.
 * 
 * @constructor
 * @classdesc Resources are used to abstract away data management and
 *            validation.
 * 
 * @param {String}
 *                name name of the resource
 * @param {Object}
 *                schema JSON Schema for validation of instances
 * 
 */
function Resource(name, schema) {
  var self = this;
  this.schema = schema;
  this.name = name;

  this.allProperties = schema.properties;
  if (typeof schema.allOf != 'undefined') {
    schema.allOf.reverse().forEach(function (inc) {
      var other = {};
      if (typeof inc['$ref'] != 'undefined')
        other = exports.commonSchemas[inc['$ref']];
      else
        other = inc;

      if (typeof other.properties == 'undefined')
        return;
      
      self.allProperties = append(other.properties, self.allProperties);
    });
  }

  // constructor for instances of this resource
  this.Instance = function(properties) {
    var inst = this;

    // define not-enumerable properties
    Object.defineProperty(this, 'resource', {
      enumerable: false,
      value: self
    });

    Object.defineProperty(this, 'properties', {
      enumerable: false,
      set: function (properties) {
        // remove old keys
        Object.keys(inst).forEach(function (k) {
          delete inst[k];
        });

        // append new
        append(inst, properties);
      },
      get: function () {
        return properties;
      }
    });

    // mix all properties from properties into this
    append(this, properties);
  };
  this.Instance.prototype = new ResourceInstance;
}

Resource.prototype = new events.EventEmitter;
exports.Resource = Resource;

/**
 * Emits the 'init' event.
 * 
 * @private
 */
Resource.prototype.init = function() {
  this.emit('init', this);
};

/**
 * Creates a new instance of the resource and saves it.
 * 
 * @param {Object}
 *                properties properties, the resulting instance will have
 * @param {Function(err,instance)}
 *                callback
 */
Resource.prototype.create = function(properties, callback) {
  var instance = this.instantiate(properties);
  instance.save(callback);
};

/**
 * Updates an instance of the resource. (Must have an _id property)
 * 
 * @param {Object}
 *                properties properties, the resulting instance will have
 * @param {Function(err,instance)}
 *                callback
 */
Resource.prototype.save = Resource.prototype.create;

/**
 * Updates an instance of the resource. (Must match the criteria)
 * 
 * @param {Object}
 *                properties properties, the resulting instance will have
 * @param {Function(err,instance)}
 *                callback
 */
Resource.prototype.update = function(criteria, properties, options, callback) {
  if (arguments.length == 3) {
    callback = options;
    options = {};
  }

  var instance = this.instantiate(properties);
  var collName = pluralize(this.name);
  exports.database.getCollection(collName, function(err, coll) {
    if (err)
      return callback(err);

    coll.update(criteria, properties, options, function (err, result) {
      if (err)
        return callback(err);

      callback(null, result);
    });
  });
};

/**
 * Creates an instance with some properties.
 * 
 * @param {Object}
 *                properties properties, the resulting instance will have
 * 
 * @returns {ResourceInstance} new instance
 */
Resource.prototype.instantiate = function(properties) {
  return new (this.Instance)(properties);
};

Resource.prototype.__defineGetter__('_resource', function() {
  return this.name;
});

Resource.prototype.__defineGetter__('lowerResource', function() {
  return pluralize(this.name);
});

/**
 * Creates an instance of a resource. Instances are usually created via
 * `Resource.create()`.
 * 
 * @constructor
 * @classdesc Resources are used to abstract away data management and
 *            validation.
 * 
 * @param {String}
 *                name name of the resource
 * @param {Object}
 *                schema JSON Schema for validation of instances
 */
function ResourceInstance() {
}
exports.ResourceInstance = ResourceInstance;

/**
 * Validates itself by using the global JSON Schema validator.
 * 
 * @returns {Object[]} an array of objects that contain error information
 */
ResourceInstance.prototype.validate = function() {
  var errs = exports.validator.validate(this.properties, this.resource.schema);

  // transform the errors into a more convenient format
  var len = errs.length;
  var i, e1, e2;
  for (i = 0; i < len; i++) {
    e1 = errs[i];

    e2 = {
      errorType: e1.kind,
      errorMessage: e1.desc
    };

    var context = e1.instanceContext;

    if (context !== "#")
      e2.property = context.replace(/^#\//, '').replace(/\//g, '.');
    
    if (typeof e1.testedValue != 'undefined')
      e2.value = e1.testedValue;

    e2.constraint = {};
    e2.constraint[e1.constraintName] = e1.constraintValue;

    errs[i] = e2;
  }

  return errs;
};

/**
 * Get an array of matching instances.
 * 
 * @param {String|Object}
 *                query _id or query object that all resulting instances match
 * @param {Object}
 *                [options]
 * @param {Function(err,instances)}
 *                callback
 */
Resource.prototype.get = function (query, fields, options, callback) {
  if (arguments.length == 2) {
    callback = fields;
    options = {};
    fields = {};
  } else if (arguments.length == 3) {
    callback = options;
    options = {};
  }

  var resource = this;

  if (typeof query == 'string')
    query = { _id: query };

  var collName = pluralize(this.name);

  exports.database.getCollection(collName, function(err, coll) {
    if (err)
      return callback(err);

    coll.find(query, fields, options, function (err, results) {
      if (err)
        return callback(err);

      // instantiate all objects
      var len = results.length;
      for (var i = 0; i < len; i++) {
        results[i] = resource.instantiate(results[i]);
      }
      callback(null, results);
    });
  });
};

/**
 * Get the first matching instance.
 * 
 * @param {String|Object}
 *                query _id or query object that all resulting instances match
 * @param {Object}
 *                [fields]
 * @param {Object}
 *                [options]
 * @param {Function(err,instance)}
 *                callback
 */
Resource.prototype.getOne = function (query, fields, options, callback) {
  if (arguments.length == 2) {
    callback = fields;
    options = {};
    fields = {};
  } else if (arguments.length == 3) {
    callback = options;
    options = {};
  }

  var resource = this;

  if (typeof query == 'string')
    query = { _id: query };

  var collName = pluralize(this.name);

  exports.database.getCollection(collName, function(err, coll) {
    if (err)
      return callback(err);

    coll.findOne(query, fields, options, function (err, result) {
      if (err)
        return callback(err);

      // instantiate object
      result = resource.instantiate(result);

      callback(null, result);
    });
  });
};

/**
 * Count all matching instances.
 * 
 * @param {Object}
 *                [query]
 * @param {Object}
 *                [options]
 * @param {Function(err,count)}
 *                callback
 */
Resource.prototype.count = function(query, options, callback) {
  if (arguments.length == 1) {
    callback = query;
    query = {};
    options = {};
  } else if (arguments.length == 2) {
    callback = options;
    options = {};
  }
  
  var collName = pluralize(this.name);
  exports.database.getCollection(collName, function (err, coll) {
    coll.count(query, options, callback);
  });
};

/**
 * Get an array of all instances of the schema.
 * 
 * @param {Object}
 *                [fields]
 * @param {Object}
 *                [options]
 * @param {Function(err,instances)}
 *                callback
 */
Resource.prototype.all = function(fields, options, callback) {
  if (arguments.length == 1) {
    callback = fields;
    options = {};
    fields = {};
  } else if(arguments.length == 2) {
    callback = fields;
    options = {};
  }

  // query all schema instances
  this.get({}, fields, options, callback);
};

/**
 * Saves itself to the database. If the instance already exists in the database,
 * the old instance is replaced.
 * 
 * @param {Object}
 *                [options]
 * @param {Function(err,saved)}
 *                callback
 */
ResourceInstance.prototype.save = function(options, callback) {
  if (arguments.length == 1) {
    callback = options;
    options = {};
  }

  var instance = this;

  // validate instance
  var errors = this.validate();
  if (errors.length > 0) {
    return callback(errors);
  }

  // collection name is the plural of resource name
  var collName = pluralize(this.resource.name);

  // get collection and save to the database
  exports.database.getCollection(collName, function(err, coll) {
    if (err)
      return callback(err);

    // FIXME callback must receive new instance as a result
    coll.save(instance.properties, options, function(err, saved) {
      if (typeof saved == 'number')
        return callback(null, instance);

      instance.properties = saved;
      callback(null, instance);
    });
  });
};

/**
 * Deletes all matching instances.
 * 
 * @param {Object}
 *                query
 * @param {Function(err,deleted)}
 *                callback
 */
Resource.prototype.delete = function(query, callback) {
  var collName = pluralize(this.name);

  exports.database.getCollection(collName, function (err, coll) {
    if (err)
      return callback(err);

    coll.delete(query, callback);
  });
};
