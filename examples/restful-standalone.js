var restposten = require('..');
var dbConnector = require('restposten-memory');
var JaySchema = require('jayschema');
var restful = require('restful');

var model = require('./model.js');

restposten.validator = new JaySchema;

dbConnector.connect({
  name : 'restposten_test'
}, function(err, db) {
  if (err)
    throw err;

  restposten.database = db;
  
  // create model
  schemas = model(restposten);
  
  var server = restful.createServer(schemas);
  server.listen(8080, function() {
    console.log('> http server started on port 8080');
  });
});
