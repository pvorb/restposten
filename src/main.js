var events = require('events');

var persistence = exports;
persistence.Resource = require('./resource');
persistence.resources = {};

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
 * Sets the storage engine.
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
 * Defines a new resource factory for creating resources.
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
    var resource = new persistence.Resource(name, attrs);
    return resource;
  }

  // set schema
  factory.schema = schema;

  // prototype inheritance
  Factory.__proto__ = persistence.Resource;
  Factory.prototype.__proto__ = persistence.Resource.prototype

  // define some hooks
  Factory.hooks = {
    before : {},
    after : {}
  };

  Factory.emitter = new events.EventEmitter;

  return Factory;
};
