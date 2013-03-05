'use strict';

var events = require('events');
var append = require('append');
var errs = require('errs');
var inflection = require('i')();
var pluralize = inflection.pluralize;
var camelize = inflection.camelize;
var errors = require('./errors.js');

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
 */
var persistence = exports;
persistence.schemas = {};
persistence.deferredRelationships = {};

persistence._validator;
persistence._engine;

// getter / setter for validator
persistence.__defineSetter__('validator', function(validator) {
  return persistence._validator = validator;
});

persistence.__defineGetter__('validator', function() {
  return persistence._validator;
});

// getter / setter for engine
persistence.__defineSetter__('engine', function(engine) {
  return persistence._engine = engine;
});

persistence.__defineGetter__('engine', function() {
  return persistence._engine;
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
var SchemaInstance = persistence.SchemaInstance = function SchemaInstance() {
  Object.defineProperty(this, 'isNewRecord', {
    value : true,
    writable : true
  });

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

// getter / setter for key property. The key property should be defined for all
// engines.
SchemaInstance.__defineGetter__('key', function() {
  return this._key || persistence.key || 'id';
});
SchemaInstance.__defineSetter__('key', function(val) {
  return this._key = val;
});

// getter / setter for connection property
SchemaInstance.__defineGetter__('connection', function () {
  return this._connection || persistence.connection;
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

  var now = Date.now();
  obj.mtime = now;
  if (obj.isNewRecord) {
    obj.ctime = now;
  }
  
  var collName = pluralize(this.resource);
  
  // ensure if engine is already set
  if (typeof persistence.engine == 'undefined')
    throw errs.create('EngineUndefined');
  
  persistence.engine.getCollection(collName, function (err, coll) {
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
 */
SchemaInstance.create = function(attrs, callback) {
  var instance = new (this)(attrs);
  var that = this;

  if (typeof persistence.validator == 'undefined')
    throw errs.create('ValidatorUndefined');

  var e = persistence.validator.validate(instance, this.schema);
  var invalid = e.length > 0;
  if (invalid) {
    var opts = { errors: e, value: attrs, schema: this.schema };
    var error = errs.create('ValidationError', opts);
    this.emit('error', error);

    if (callback)
      callback(error);

    return;
  }

  var key = this.key;
  var oldid = instance[key];
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
  if (typeof persistence.schemas[otherSchema] == 'undefined') {
    var rel = {
      schema: from,
      property: propertyName
    };
    
    if (typeof persistence.deferredRelationships[otherSchema] == 'undefined')
      persistence.deferredRelationships[otherSchema] = [];
    
    persistence.deferredRelationships[otherSchema].push(rel);
    
    return;
  }

  var getAll = 'get' + camelize(pluralize(from.resource));
  
  // define function to get the referenced collection
  // e.g. getBooks()
  var other = persistence.schemas[otherSchema];
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
  return persistence.validator.validate(this, this.constructor.schema);
};

/**
 * Handle a request.
 * 
 * @private
 * @deprecated
 */
SchemaInstance._request = function (method, query, callback) {

  if (id) args.push(id);
  if (obj)
    args.push(obj.properties ? obj.properties : obj);
  else {
    obj = that.connection.cache.get(id) || {};
    obj[key] = id;
  }

  this.runBeforeHooks(method, obj, callback, function () {
    args.push(function (e, result) {
      if (e) {
        if (e.status >= 500) {
          throw new(Error)(e);
        } else {
          that.runAfterHooks(method, e, obj, function () {
            that.emit('error', e, obj);
            if (callback)
              callback(e);
          });
        }
      } else {
        if (Array.isArray(result)) {
          result = result.map(function (r) {
            return r ? persistence.instantiate.call(that, r) : r;
          });
        } else {
          if (method === 'destroy') {
            persistence.engine.cache.clear(id);
          } else {
            persistence.engine.cache.put(result[key], result);
            result = persistence.instantiate.call(that, result);
          }
        }

        that.runAfterHooks(method, null, result, function (e, res) {
          if (e) { that.emit('error', e); }
          else   { that.emit(method, res || result); }
          if (callback) {
            callback(e || null, result);
          }
        });
      }
    });
    
    persistence.engine[method].apply(persistence.engine, args);
  });
};

/**
 * Get the instance with the specified id.
 */
SchemaInstance.get = function (query, options, callback) {
  if (arguments.length == 2) {
    callback = options;
    options = {};
  }
  
  var key = this.key;

  if (this.schema.properties[key] && this.schema.properties[key].sanitize) {
    id = this.schema.properties[key].sanitize(id);
  }

  var plural = pluralize(this.resource);
  var newid, oldid;
  
  if (query && query[key]) { // if query object
    newid = plural + "/" + query[key];
    oldid = query[key];
  } else if(Array.isArray(query)) { // if array
    for(var i in query) {
      query[i] = plural + "/" + query[i];
    }
    newid = query;
  } else if (typeof query == 'string') { // if string
    newid = plural + "/" + query;
    oldid = query;
  } else {
    if (callback) {
      return callback(new Error('key is undefined'));
    }
    return;
  }

  this._request('get', newid, function(err, res){
    //
    // Remap back original ids
    //
    if(res && typeof res[key] !== 'undefined') {
      res[key] = oldid;
    }
    if(Array.isArray(res)) {
      for(var r in res) {
        if (res[r] && res[r][key]) {
          res[r][key] = res[r][key].split('/').slice(1).join('/')
        }
      }
    }
    if(res) {
      callback(err, res);
    } else {
      return callback(err, res)
    }
  });
};

/**
 * Saves the instance.
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

  this.constructor.save(this, function(err, res) {
    if (!err)
      self.isNewRecord = false;
    
    if (callback)
      callback(err, res);
  })
};

/**
 * Deletes the instance.
 * 
 * @param id
 *            id of the instance
 */
SchemaInstance.delete = function(id, callback) {
  var key = this.key;

  if (this.schema.properties[key] && this.schema.properties[key].sanitize) {
    id = this.schema.properties[key].sanitize(id);
  }

  var newid = pluralize(this.resource) + "/" + id;

  return newid ? this._request('destroy', newid, callback) : callback
      && callback(new Error('key is undefined'));
};

/**
 * Overwrites the instance.
 * 
 * TODO adjust
 */
SchemaInstance.update = function(id, obj, callback) {
  var key = this.key;

  if (this.schema.properties[key] && this.schema.properties[key].sanitize) {
    id = this.schema.properties[key].sanitize(id);
  }

  if (this._mtime) {
    obj.mtime = Date.now();
  }

  var self = this, partialSchema = {
    properties : {}
  }, validate;

  // TODO check linking IDs
  Object.keys(obj).forEach(function(key) {
    if (self.schema.properties[key]) {
      partialSchema.properties[key] = self.schema.properties[key];
    }
  });

  validate = this.prototype.validate({
    _properties : obj
  }, partialSchema);

  if (!validate.valid) {
    var e = {
      validate : validate,
      value : obj,
      schema : this.schema
    };
    this.emit('error', e);
    if (callback) {
      callback(e);
    }
    return;
  }

  var newid = pluralize(this.resource) + "/" + id, oldid = id;
  obj[key] = newid;
  obj.resource = this._resource;

  return id ? this._request('update', newid, obj, function(err, result) {
    if (result) {
      result[key] = oldid;
      obj[key] = oldid;
    }
    callback && callback(err, result);
  }) : callback && callback(new Error('key is undefined'));
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

SchemaInstance.runAfterHooks = function(method, e, obj, finish) {
  if (method in this.hooks.after) {
    (function loop(hooks) {
      var hook = hooks.shift();

      if (hook && hook.length === 3) {
        hook(e, obj, function(e, obj) {
          if (e) {
            finish(e, obj);
          } else {
            loop(hooks);
          }
        });
      } else if (hook && hook.length === 2) {
        var res = hook(e, obj);
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
persistence.define = function(name, schema) {

  var Factory = function Factory(attrs) {
    var self = this;
    persistence.SchemaInstance.call(this);

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
    for ( var m in Factory) {
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
      persistence.defineProperty(self, k, Factory.properties[k]);
    });

    return this;
  }

  // prototype inheritance
  Factory.__proto__ = persistence.SchemaInstance;
  Factory.prototype.__proto__ = persistence.SchemaInstance.prototype;

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

  // set before and after hooks
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
  persistence.register(name, Factory);

  return Factory;
};

/**
 * Registers a schema.
 */
persistence.register = function(name, schema) {
  return this.schemas[name] = schema;
};

/**
 * Unregisters a schema.
 */
persistence.unregister = function(name) {
  delete this.schemas[name];
};

/**
 * Instantiate an object if it hasn't already been instantiated.
 */
persistence.instantiate = function(obj) {
  var Factory = persistence.schemas[this.resource];
  var id = obj[this.key];

  if (id && persistence.engine.cache.has(id)) {
    obj = persistence.engine.cache.get(id);
  }
  
  if (Factory) {
    // Don't instantiate an already instantiated object
    if (obj instanceof Factory) {
      return obj;
    } else {
      var instance = new Factory(obj);
      instance.isNewRecord = false;
      return instance;
    }
  } else {
    throw new Error("unrecognised resource '" + obj.name + "'");
  }
};

/**
 * Define a property on the Schema.
 */
persistence.defineProperty = function(obj, property, schema) {
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

  Object.defineProperty(obj, property, {
    get : function() {
      return this.readProperty(property, schema.get);
    },
    set : schema.sanitize ? (function(val) {
      return this.writeProperty(property, schema.sanitize(val), schema.set);
    }) : (function(val) {
      return this.writeProperty(property, val, schema.set);
    }),
    enumerable : true
  });

  if (typeof obj[property] === 'undefined') {
    obj[property] = init(obj, property, schema);
  }
};

