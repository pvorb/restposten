var validators = exports;

instances = {};

/**
 * Returns the requested validator by name.
 */
validators.getValidator = function (name, callback) {
  if (typeof instances[name] == 'undefined') {
    try {
      var validator = require('./'+name);
      instances[name] = validator;
      return callback(null, validator);
    } catch (e) {
      return callback(e);
    }
  }
  
  return callback(null, instances[name]);
};
