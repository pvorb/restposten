var persistence = require('..');
var dbConnector = require('persistence-memory');
var JaySchema = require('jayschema');
var restful = require('restful');

var model = require('./model.js');

persistence.validator = new JaySchema;

dbConnector.connect({
  name : 'persistence_test'
}, function(err, db) {
  if (err)
    throw err;

  persistence.engine = db;
  
  // create model
  schemas = model(persistence);
  
  restful.createServer(model);
});
