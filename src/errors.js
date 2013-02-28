var util = require('util');
var errs = require('errs');

function ValidationError(errors, instance, schema) {
  this.errors = errors;
  this.instance = instance;
  this.schema = schema;
}

util.inherits(ValidationError, Error);
errs.register('ValidationError', ValidationError);
