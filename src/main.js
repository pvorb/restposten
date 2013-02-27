'use strict';

var events = require('events');

var persistence = exports;
persistence.SchemaInstance = require('./schema_instance').SchemaInstance;
persistence.schemas = {};

persistence.validator;
persistence._engine;

/*persistence.__defineSetter__('validator', function(validator) {
  return persistence._validator = validator;
});

persistence.__defineGetter__('validator', function() {
  return persistence._validator;
});*/

persistence.__defineSetter__('engine', function(engine) {
  return persistence._engine = engine;
});

persistence.__defineGetter__('engine', function() {
  return persistence._engine;
});

/**
 * Defines a new factory schema for creating instances of schemas.
 * 
 * @param name
 *            string
 * @param schema
 *            JSON schema object
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

    this._properties.name = name;

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

  // set name
  Factory.name = name;

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

  Factory.define(schema);
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
 * TODO: needed? run by runBeforeHooks
 */
persistence.instantiate = function(obj) {
  var instance, Factory, id;

  Factory = persistence.resources[this.name];

  id = obj[this.key];

  if (id && this.engine.cache.has(id)) {
    obj = this.engine.cache.get(id);
  }

  if (Factory) {
    // Don't instantiate an already instantiated object
    if (obj instanceof Factory) {
      return obj;
    } else {
      instance = new Factory(obj);
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
