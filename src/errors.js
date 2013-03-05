var util = require('util');
var errs = require('errs');

function ValidationError(errors, instance, schema) {
  this.errors = errors;
  this.instance = instance;
  this.schema = schema;
}

util.inherits(ValidationError, Error);
errs.register('ValidationError', ValidationError);

function EngineUndefinedError() {
}

util.inherits(EngineUndefinedError, Error);
errs.register('EngineUndefined', EngineUndefinedError);

function ValidatorUndefinedError() {
}

util.inherits(ValidatorUndefinedError, Error);
errs.register('ValidatorUndefined', ValidatorUndefinedError);
