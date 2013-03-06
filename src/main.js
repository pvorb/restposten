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
  // init local schema
  Object.defineProperty(this, 'schema', {
    value : this.constructor.schema,
    enumerable : false,
    configurable : true
  });
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
  var errors = this.prototype.validate(obj, this.schema); // find errors

  if (errors.length > 0 && callback) {
    var err = errs.create('ValidationError', { validate: validate, value: obj,
      schema: this.schema });
    return callback(err);
  }

  var collName = pluralize(this.resource);
  
  // ensure if engine is already set
  if (typeof exports.engine == 'undefined')
    throw errs.create('EngineUndefined');
  
  exports.engine.getCollection(collName, function (err, coll) {
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
  var extended = append(this._schema, schema);
  var that = this;
  
  // go through the schema's properties and check for links with "rel": "full"
  var props = extended.properties;
  var keys = Object.keys(props);
  var property;
  var lenLinks;
  var links, link;
  var i;
  
  Object.keys(props).forEach(function (key) {
    property = props[key];
    if (typeof property.links == 'undefined')
      return;
    
    links = property.links;
    lenLinks = links.length;
    for (i = 0; i < lenLinks; i++) {
      link = links[i];
      if (link.rel === 'full')
        foreignKey(that, key, link.href);
    }
  });
  
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
  var that = this;

  if (typeof exports.validator == 'undefined')
    throw errs.create('ValidatorUndefined');

  var e = exports.validator.validate(instance, this.schema);
  var invalid = e.length > 0;
  if (invalid) {
    var opts = { errors: e, value: attrs, schema: this.schema };
    var error = errs.create('ValidationError', opts);
    this.emit('error', error);

    if (callback)
      callback(error);

    return;
  }

  this.runBeforeHooks('create', instance, callback, function(err, result) {
    if (invalid) {
      that.emit('error', err);
      if (callback)
        callback(e);
      return;
    }

    that.runAfterHooks('create', null, instance, function (err, res) {
      if (err)
        return that.emit('error', err);
      
      instance.save(function (err, res) {
        if (callback)
          callback(err, res);
      });
    });
  });
};

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
    var query = {};
    query[propertyName] = this.id;
    from.get(query, callback);
  };
  
  var getOne = 'get' + camelize(otherSchema);
  
  // define function to get the referenced document
  // e.g. getAuthor()
  from.prototype[getOne] = function(callback) {
    other.get(this[propertyName], callback);
  }
};

/**
 * Validates the instance.
 */
SchemaInstance.prototype.validate = function() {
  return exports.validator.validate(this, this.constructor.schema);
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
  
  if (typeof query == 'string') {
    query = { _id: query };
  }
  
  var collName = pluralize(this.resource);
  
  exports.engine.getCollection(collName, function(err, coll) {
    if (err)
      return callback(err);
    
    coll.find(query, options, callback);
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
      schema : this.schema
    });

    return callback(err);
  }

  // call SchemaInstance.save()
  this.constructor.save(this._properties, callback);
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

// Hooks
SchemaInstance.after = function(event, callback) {
  this.hook(event, 'after', callback);
};

SchemaInstance.before = function(event, callback) {
  this.hook(event, 'before', callback);
};

SchemaInstance.hook = function(event, timing, callback) {
  this.hooks[timing][event] = this.hooks[timing][event] || [];
  this.hooks[timing][event].push(callback);
};

/**
 * Runs all registered before-hooks for a specific event.
 * 
 * @param {String}
 *            method
 * @param {Object}
 *            obj
 * @param {Function(err,
 *            obj)} callback
 * @param {Function()}
 *            finish
 */
SchemaInstance.runBeforeHooks = function(method, obj, callback, finish) {
  if (method in this.hooks.before) {
    (function loop(hooks) {
      var hook = hooks.shift();

      if (hook && hook.length === 2) {
        hook(obj, function(e, obj) {
          if (e || obj) {
            if (callback) {
              callback(e, obj);
            }
          } else {
            loop(hooks);
          }
        });
      } else if (hook && hook.length === 1) {
        var res = hook(obj);
        if (res === true) {
          loop(hooks);
        } else {
          if (callback) {
            callback(res, obj);
          }
        }
      } else {
        finish();
      }
    })(this.hooks.before[method].slice(0));
  } else {
    finish();
  }
};


/**
 * Runs all registered after-hooks for a specific event.
 * 
 * @param {String}
 *            method
 * @param {Error}
 *            err
 * @param {Object}
 *            obj
 * @param {Function(res,
 *            obj)} finish
 */
SchemaInstance.runAfterHooks = function(method, err, obj, finish) {
  if (method in this.hooks.after) {
    (function loop(hooks) {
      var hook = hooks.shift();

      if (hook && hook.length === 3) {
        hook(err, obj, function(err, obj) {
          if (err) {
            finish(err, obj);
          } else {
            loop(hooks);
          }
        });
      } else if (hook && hook.length === 2) {
        var res = hook(err, obj);
        if (res === true) {
          loop(hooks);
        } else {
          finish(res, obj);
        }
      } else {
        finish();
      }
    })(this.hooks.after[method].slice(0));
  } else {
    finish();
  }
};

/**
 * Defines a new factory schema for creating instances of schemas.
 * 
 * @param {String}
 *            name
 * @param {Object}
 *            schema JSON schema object
 * @returns factory function for creating new instances
 */
exports.define = function(name, schema) {

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

    this._properties.resource = name;

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

  // define the properties that each schema must have

  // set resource name
  Factory.resource = name;

  // set schema
  Factory.define(schema);

  // define some hooks
  Factory.hooks = {
    before : {},
    after : {}
  };

  // set arrays for before and after hooks
  [ 'get', 'save', 'update', 'create', 'destroy' ].forEach(function(m) {
    Factory.hooks.before[m] = [];
    Factory.hooks.after[m] = [];
  });

  Factory.emitter = new events.EventEmitter();

  // register emitter methods with factory
  Object.keys(events.EventEmitter.prototype).forEach(function(k) {
    Factory[k] = function() {
      return Factory.emitter[k].apply(Factory.emitter, arguments);
    };
  });
  
  // emit 'init' event
  Factory.init();

  // Add this schema to the set of resources, persistence knows about
  exports.register(name, Factory);

  return Factory;
};

/**
 * Registers a schema.
 */
exports.register = function(name, schema) {
  return this.schemas[name] = schema;
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
  var id = obj[this.key];
  
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
 * 
 * TODO still needed?
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

  if (typeof obj[property] === 'undefined') {
    obj[property] = init(obj, property, schema);
  }
};

