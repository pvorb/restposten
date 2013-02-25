var memory = exports;

var stores = memory.stores = {};

/**
 * Connects to MongoDB.
 * 
 * @param options
 *            [optional]
 * @param callback
 *            (err, db)
 */
memory.connect = function(options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  callback(null, new Memory(options));
};

memory.protocol = 'memory';

/**
 * Memory engine constructor.
 * 
 * @param options
 */
function Memory(options) {
  options = options || {};

  this.uri = options.uri;

  // application-wide store
  if (typeof options.uri == 'string')
    if (!stores[this.uri])
      this.store = stores[this.uri] = {};
    else
      this.store = stores[this.uri];
  // connection-wide store
  else
    this.store = {};
};

/**
 * Get a value from the db.
 * 
 * @param callback
 *            (err, result)
 */
Memory.prototype.get = function(query, callback) {
  if (typeof query == 'string') {
    var res = this.store[query];
    if (typeof res != 'undefined')
      callback(null, res);
    else
      callback(new Error(query + ' not found.'));
  }
  // TODO query objects
};

/**
 * Save a value to the db.
 * 
 * @param id
 * @param val
 * @param callback
 *            (err, changeCount)
 */
Memory.prototype.save = function(id, val, callback) {
  this.store[id] = val;
  callback(null, 1);
};
