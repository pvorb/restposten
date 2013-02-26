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
 * 
 * TODO adjust
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

/**
 * TODO adjust
 */
SchemaInstance.destroy = function(id, callback) {
  var key = this.key;

  if (this.schema.properties[key] && this.schema.properties[key].sanitize) {
    id = this.schema.properties[key].sanitize(id);
  }

  var newid = this.lowerResource + "/" + id;

  return newid ? this._request('destroy', newid, callback) : callback
      && callback(new Error('key is undefined'));
};

/**
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

  var newid = this.lowerResource + "/" + id, oldid = id;
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

// Define getter / setter for resource property
SchemaInstance.__defineGetter__('name', function() {
  return this._name;
});
SchemaInstance.__defineSetter__('name', function(name) {
  return this._name = name;
});

// Define getter for properties, wraps this resources schema properties
SchemaInstance.__defineGetter__('schema', function() {
  return this.schema.properties;
});

// Define getter / setter for key property. The key property should be defined
// for all engines
SchemaInstance.__defineGetter__('key', function() {
  return this._key || resourceful.key || 'id';
});
SchemaInstance.__defineSetter__('key', function(val) {
  return this._key = val;
});

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
