'use strict';

var events = require('events');

var persistence = exports;
persistence.SchemaInstance = require('./schema_instance');
persistence.schemas = {};

persistence._validator = null;
persistence._engine = null;

persistence.__defineSetter__('validator', function(validator) {
  return this._validator = validator;
});

persistence.__defineGetter__('validator', function() {
  return this._validator;
});

persistence.__defineSetter__('engine', function(engine) {
  return persistence.engine = engine;
});

persistence.__defineGetter__('engine', function() {
  return persistence.engine;
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

  function Factory(attrs) {
    var self = this;
    persistence.SchemaInstance.call(this, attrs, schema);

    // verify methods
    for ( var m in Factory) {
      if (typeof Factory[m] != 'undefined' && Factory[m].type === 'method') {
        if (typeof this[m] != 'undefined')
          throw new Error(m + ' is a reserverd word on the schema instance');
      }
      this[m] = Factory[m];
      this[m].type = "method";
      this[m].required = false;
    }

    // define properties from schema
    Object.keys(this._properties).forEach(function(k) {
      resourceful.defineProperty(self, k, Factory.schema.properties[k]);
    });

    return instance;
  }

  // define the properties that each schema must have

  // set name
  Factory.name = name;

  // set schema
  Factory.schema = schema;

  // prototype inheritance
  Factory.__proto__ = persistence.SchemaInstance;
  Factory.prototype.__proto__ = persistence.SchemaInstance.prototype

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

  // register hooks with event emitter
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
