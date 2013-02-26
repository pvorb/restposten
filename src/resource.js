'use strict';

var validator = require('./common').validator;

var Resource = exports.Resource = function Resource(attrs) {
  Object.defineProperty(this, '_properties', {
    value : attrs,
    enumerable : false
  });

  Object.keys(this.properties).forEach(function(p) {

  });
};

Resource.create = function(attrs, callback) {
  var instance = new (this)(attrs);

  var validate = Resource.validate(instance, this.schema);
};

Resource.prototype.validate = function() {
  validator.validate(this, this.constructor.schema);
};

Resource.prototype.save = function(callback) {
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
