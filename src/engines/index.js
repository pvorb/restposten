var engines = exports;

var instances = engines.instances = {};

engines.get = function(name, options, callback) {
  // TODO to use callback or not to use, that is the question
  if (typeof instances[name] == 'undefined')
    require('./' + name).connect(options, function(err, db) {
      if (err)
        return callback(err);

      instances[name] = db;
      callback(null, db);
    });

  callback(null, instances[name]);
}
