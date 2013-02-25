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

/**
 * Memory engine constructor.
 * 
 * @param options
 */
function Memory(options) {
  options = options || {};

  var uri = this.uri = options.uri;
  var counter = 0;
  function incr() {
    return ++counter;
  }

  // application-wide store
  if (typeof options.uri == 'string')
    if (!stores[uri])
      this.store = stores[uri] = {};
    else
      this.store = stores[uri];
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
 * @param query
 *            [optional]
 * @param val
 * @param callback
 *            (err, changeCount)
 */
Memory.prototype.save = function(query, val, callback) {
  if (arguments.length < 3) {
    callback = val;
    val = query;
  }

  query += '';

  this.store[query] = val;
  callback(null, 1);
};
