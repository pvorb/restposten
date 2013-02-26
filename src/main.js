var events = require('events');

var persistence = exports;
persistence.Schema = require('./schema');
persistence.schemas = {};

persistence.validator = null;
persistence.engine = null;

/**
 * Sets the validator.
 */
persistence.setValidator = function(validator) {
  persistence.validator = validator;
};

/**
 * Gets the validator.
 */
persistence.getValidator = function() {
  return persistence.validator;
};

/**
 * Sets the storage engine.resource
 */
persistence.setEngine = function(engine) {
  persistence.engine = engine;
};

/**
 * Gets the storage engine.
 */
persistence.getEngine = function() {
  return persistence.engine;
}

/**
 * Defines a new factory schema for creating instances of schemas.
 * 
 * @param name
 *            string
 * @param schema
 *            JSON schema object
 * @param callback
 *            (err)
 */
persistence.define = function(name, schema, callback) {

  function Factory(attrs) {
    var instance = new persistence.Schema(name, attrs);
    
    for (var m in Factory) {
      if (typeof Factory[m] != 'undefined' && Factory[m].type === 'method') {
        if (typeof this[m] != 'undefined')
          throw new Error(m + ' is a reserverd word on the Schema instance');
      }
    }
    
    return instance;
  }

  // set schema
  factory.schema = schema;

  // prototype inheritance
  Factory.__proto__ = persistence.Schema;
  Factory.prototype.__proto__ = persistence.Schema.prototype

  // define some hooks
  Factory.hooks = {
    before : {},
    after : {}
  };

  Factory.emitter = new events.EventEmitter;

  return Factory;
};
