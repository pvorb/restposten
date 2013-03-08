'use strict';

/**
 * Persistence is a data persistence module for flatiron. It's an adaptation of
 * resourceful and is intended to be used as a replacement for Resourceful. It
 * uses JSON Schema for data validation. It also has support for JSON Schema
 * links, which are directly mapped to relations in the internal data model.
 * 
 * @module persistence
 * 
 * @property {Object} engine the persistence engine (must be set on startup)
 * @property {Object} validator the validator engine (must be set on startup)
 * @property {Object} schemas
 * @property {Object} deferredRelationships
 */

var events = require('events');
var append = require('append');
var errs = require('errs');
var inflection = require('i')();
var pluralize = inflection.pluralize;
var camelize = inflection.camelize;
var errors = require('./errors.js');

exports.schemas = {};
exports.deferredRelationships = {};

exports._validator;
exports._engine;

// getter / setter for validator
exports.__defineSetter__('validator', function(validator) {
  return exports._validator = validator;
});

exports.__defineGetter__('validator', function() {
  return exports._validator;
});

// getter / setter for engine
exports.__defineSetter__('engine', function(engine) {
  return exports._engine = engine;
});

exports.__defineGetter__('engine', function() {
  return exports._engine;
});

/**
 * @classdesc Instance of a Schema.
 * 
 * @constructor
 * 
 * @property {Object} schema [getter]
 * @property {Object} properties [getter]
 * @property {String} resource the name of this schema
 * @property {String} key property that is used as the ID
 * @property {Object} connection
 */
var SchemaInstance = exports.SchemaInstance = function SchemaInstance() {
};

// set initial schema
/**
 * @private
 */
SchemaInstance._schema = {
  properties : {}
};

SchemaInstance.__defineGetter__('schema', function() {
  return this._schema;
});

SchemaInstance.__defineGetter__('properties', function() {
  return this.schema.properties || {};
});

// getter / setter for resource property
SchemaInstance.__defineGetter__('resource', function() {
  return this._resource;
});
SchemaInstance.__defineSetter__('resource', function(resource) {
  return this._resource = resource;
});

// getter / setter for connection property
SchemaInstance.__defineGetter__('connection', function () {
  return this._connection || exports.connection;
});

SchemaInstance.__defineSetter__('connection', function (val) {
  return this._connection = val;
});

/**
 * Emits 'init'.
 */
SchemaInstance.init = function() {
  this.emit('init', this);
};

/**
 * Saves an object.
 * 
 * @param {Object}
 *            obj object to save
 * @param {Function(err,
 *            res)} callback
 */
SchemaInstance.save = function (obj, callback) {
  var collName = pluralize(this.resource);

  // ensure if engine is already set
  if (typeof exports.engine == 'undefined')
    throw errs.create('EngineUndefined');

  exports.engine.getCollection(collName, function(err, coll) {
    coll.save(obj, callback);
  });
};

/**
 * Define the schema.
 * 
 * @param {Object}
 *            schema JSON schema definition
 * @returns {Object} extended schema
 */
SchemaInstance.define = function(schema) {
  var extended = append(this.schema, schema);

  // resolve the relationships between this and other schemas
  resolveRelations(this);

  return extended;
};

/**
 * Creates a new instance.
 * 
 * @param {Object}
 *            attrs
 * @param {Function(err,
 *            res)} callback
 * 
 * @fires 'error'
 */
SchemaInstance.create = function(attrs, callback) {
  var instance = new (this)(attrs);
  instance.save(callback);
};


/**
 * Validates the instance.
 */
SchemaInstance.prototype.validate = function() {
  if (typeof exports.validator == 'undefined')
    throw errs.create('ValidatorUndefined');
  
  return exports.validator.validate(this.properties, this.constructor._schema);
};

/**
 * Saves the instance.
 * 
 * @param {Function(err,
 *            res)} callback
 */
SchemaInstance.prototype.save = function(callback) {
  var self = this;
  var errors = this.validate();

  // if there are errors, callback
  if (errors.length > 0 && callback) {
    var err = errors.create('ValidationError', {
      errors : errors,
      value : this,
      schema : this.constructor.schema
    });

    return callback(err);
  }

  // call SchemaInstance.save()
  this.constructor.save(this._properties, function(err, res) {
    if (err)
      return callback(err);

    var saved;
    if (typeof res == 'object')
      saved = self;
    else
      saved = res;

    callback(null, saved);
  });
};

/**
 * Get an array of matching instances.
 * 
 * @param {String|Object}
 *            query _id or query object that all resulting instances match
 * @param {Object}
 *            [options]
 * @param {Function(err,
 *            coll)} callback
 */
SchemaInstance.get = function (query, options, callback) {
  if (arguments.length == 2) {
    callback = options;
    options = {};
  }

  var schema = this;

  if (typeof query == 'string') {
    query = { _id: query };
  }

  var collName = pluralize(this.resource);

  exports.engine.getCollection(collName, function(err, coll) {
    if (err)
      return callback(err);

    coll.find(query, options, function (err, results) {
      if (err)
        return callback(err);

      // instantiate all objects
      var len = results.length;
      for (var i = 0; i < len; i++) {
        results[i] = exports.instantiate.call(schema, results[i]);
      }
      callback(null, results);
    });
  });
};

/**
 * Get the first matching instance.
 * 
 * @param {String|Object}
 *            query _id or query object that all resulting instances match
 * @param {Object}
 *            [options]
 * @param {Function(err,
 *            coll)} callback
 */
SchemaInstance.getOne = function (query, options, callback) {
  if (arguments.length == 2) {
    callback = options;
    options = {};
  }

  var schema = this;

  if (typeof query == 'string') {
    query = { _id: query };
  }

  var collName = pluralize(this.resource);

  exports.engine.getCollection(collName, function(err, coll) {
    if (err)
      return callback(err);

    coll.findOne(query, options, function (err, result) {
      if (err)
        return callback(err);

      // instantiate object
      result = exports.instantiate.call(schema, result);

      callback(null, result);
    });
  });
};

/**
 * Get an array of all instances of the schema.
 * 
 * @param {Object}
 *            [options]
 * @param {Function(err,
 *            coll)} callback
 */
SchemaInstance.all = function(options, callback) {
  if (arguments.length == 1) {
    callback = options;
    options = {};
  }

  // query all schema instances
  this.get({}, options, callback);
};

/**
 * Deletes the instance.
 * 
 * @param {String}
 *            id id of the instance
 */
SchemaInstance.delete = function(id, callback) {
  var collName = pluralize(this.resource);

  exports.engine.getCollection(collName, function (err, coll) {
    if (err)
      return callback(err);

    coll.delete({ _id: id }, callback);
  });
};

SchemaInstance.prototype.readProperty = function(k, getter) {
  return getter ? getter.call(this, this._properties[k]) : this._properties[k];
};

SchemaInstance.prototype.writeProperty = function(k, val, setter) {
  return this._properties[k] = setter ? setter.call(this, val) : val;
};

/**
 * Defines a new schema factory for creating instances of schemas.
 * 
 * @param {String}
 *            [name] lower case singular name of the schema (e.g. `'address'`)
 * @param {Object}
 *            schema JSON schema object
 * @returns factory function for creating new instances
 */
exports.define = function(name, schema) {
  if (arguments.length == 1) {
    schema = name;
    if (typeof schema.name == 'undefined')
      throw new Error('no name set on schema definition');
    name = schema.name;
  }

  var Factory = function Factory(attrs) {
    var self = this;
    exports.SchemaInstance.call(this);

    // set attributes
    Object.defineProperty(this, '_properties', {
      value : {},
      enumerable : false
    });

    Object.keys(Factory.properties).forEach(function(k) {
      if (typeof Factory.properties[k]['default'] != 'undefined')
        self._properties[k] = Factory.properties[k]['default'];
    });

    if (attrs) {
      Object.keys(attrs).forEach(function(k) {
        if (typeof attrs[k] != 'undefined')
          self._properties[k] = attrs[k];
      });
    }

    // verify methods
    for (var m in Factory) {
      if (typeof Factory[m] != 'undefined' && Factory[m].type === 'method') {
        if (typeof this[m] != 'undefined')
          throw new Error(m + ' is a reserverd word on the schema instance');

        this[m] = Factory[m];
        this[m].type = "method";
        this[m].required = false;
      }
    }

    // define properties from schema
    Object.keys(this._properties).forEach(function(k) {
      exports.defineProperty(self, k, Factory.properties[k]);
    });

    return this;
  }

  // prototype inheritance
  Factory.__proto__ = exports.SchemaInstance;
  Factory.prototype.__proto__ = exports.SchemaInstance.prototype;

  // define getter for object properties
  Factory.prototype.__defineGetter__('properties', function() {
    return this._properties || {};
  });

  // define the properties that each schema must have

  // set resource name
  Factory._resource = name;
  // set schema
  Factory._schema = schema;

  // Add this schema factory to the set of schemas, persistence knows about
  exports.register(name, Factory);
  
  // check if any deferred relationships from previously schemas are related to
  // this schema
  if (typeof exports.deferredRelationships[Factory.resource] != 'undefined') {
    // for every deferredRelationship we find for our current schema, resolve it
    exports.deferredRelationships[Factory.resource].forEach(function(r) {
      resolveRelations(exports.schemas[r.schema.resource]);
    });
  }

  // set schema
  Factory.define(schema);

  Factory.emitter = new events.EventEmitter();

  // register emitter methods with factory
  Object.keys(events.EventEmitter.prototype).forEach(function(k) {
    Factory[k] = function() {
      return Factory.emitter[k].apply(Factory.emitter, arguments);
    };
  });

  // emit 'init' event
  Factory.init();

  return Factory;
};

/**
 * Resolves the relations for a schema.
 * 
 * @param factory
 * 
 * @private
 */
function resolveRelations(factory) {
  var schema = factory.schema;
  var props = schema.properties;
  
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
        foreignKey(factory, key, link.href);
    }
  });
}

/**
 * Creates a foreign key relationship. (One-To-Many)
 * 
 * @private
 */
function foreignKey(from, propertyName, href) {
  var components = href.split('/');

  // this method will only work for standard values like href = 'author/{@}'
  if (components.length != 2 && components[1] !== "{@}")
    return;

  var otherSchema = components[0];

  // if other schema is not yet defined, defer relationship
  if (typeof exports.schemas[otherSchema] == 'undefined') {
    var rel = {
      name: from.resource,
      schema: from,
      property: propertyName
    };

    if (typeof exports.deferredRelationships[otherSchema] == 'undefined')
      exports.deferredRelationships[otherSchema] = [];

    exports.deferredRelationships[otherSchema].push(rel);

    return;
  }

  var getAll = 'get' + camelize(pluralize(from.resource));

  // define function to get the referenced collection
  // e.g. getBooks()
  var other = exports.schemas[otherSchema];
  other.prototype[getAll] = function(callback) {
    var query = { propertyName: this._id };
    from.get({}, callback);
  };

  var getOne = 'get' + camelize(otherSchema);

  // define function to get the referenced document
  // e.g. getAuthor()
  from.prototype[getOne] = function(callback) {
    other.getOne(this[propertyName], callback);
  }
};

/**
 * Registers a schema.
 */
exports.register = function(name, schema) {
  return exports.schemas[name] = schema;
};

/**
 * Unregisters a schema.
 */
exports.unregister = function(name) {
  delete this.schemas[name];
};

/**
 * Instantiate an object if it hasn't already been instantiated.
 */
exports.instantiate = function(obj) {
  var Factory = exports.schemas[this.resource];

  if (Factory) {
    // Don't instantiate an already instantiated object
    if (obj instanceof Factory) {
      return obj;
    } else {
      var instance = new Factory(obj);
      return instance;
    }
  } else {
    throw new Error("unrecognised resource '" + obj.name + "'");
  }
};

/**
 * Defines a property on the Schema.
 */
exports.defineProperty = function(obj, property, schema) {
  schema = schema || {};

  // Call setter if needed
  if (schema.set) {
    obj.writeProperty(property, obj.readProperty(property), schema.set);
  }

  // Sanitize defaults and per-creation properties
  if (schema.sanitize) {
    var val = obj.readProperty(property);
    if (val !== undefined) {
      obj.writeProperty(property, schema.sanitize(val));
    }
  }

  // predefine setter
  var setter;
  if (schema.sanitize) {
    setter = function(val) {
      return this.writeProperty(property, schema.sanitize(val), schema.set);
    };
  } else {
    setter = function(val) {
      return this.writeProperty(property, val, schema.set);
    };
  }

  // define the property
  Object.defineProperty(obj, property, {
    get : function() {
      return this.readProperty(property, schema.get);
    },
    set : setter,
    enumerable : true
  });

  if (typeof obj[property] == 'undefined') {
    obj[property] = init(obj, property, schema);
  }
};

