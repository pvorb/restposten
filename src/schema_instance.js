'use strict';

var validator = require('./main').validator;

var SchemaInstance = exports.SchemaInstance = function SchemaInstance(attrs) {
  // set attributes
  Object.defineProperty(this, '_properties', {
    value : attrs,
    enumerable : false
  });

  // init local schema
  Object.defineProperty(this, 'schema', {
    value : this.constructor.schema,
    enumerable : false,
    configurable : true
  });
};

/**
 * Emits 'init'.
 */
SchemaInstance.init = function() {
  this.emit('init', this);
}

/**
 * Creates a new instance.
 */
SchemaInstance.create = function(attrs, callback) {
  var instance = new (this)(attrs);

  var validate = SchemaInstance.validate(instance, this.schema);
};

/**
 * Validates the instance.
 */
SchemaInstance.prototype.validate = function() {
  validator.validate(this, this.constructor.schema);
};

/**
 * Saves the instance.
 */
SchemaInstance.prototype.save = function(callback) {
  var errs = this.validate();
  // if there are errors
  if (errs.length > 0) {
    var result = {
      errors : errs,
      value : this,
      schema : this.schema
    };

    return callback && callback(result);
  }

  var now = new Date();
  this.modified = now;
  if (this.isNewRecord)
    this.created = now;

  var key = this.key;

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
