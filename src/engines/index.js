var engines = exports;

var instances = engines.instances = {};

engines.get = function (name, options, callback) {
  if (typeof instances[name] == 'undefined')
    require('./' + name).connect(options, function (err, db) {
      if (err)
        return callback(err);
      
      instances[name] = db;
      callback(null, db);
    });
  
  callback(null, instances[name]);
}
