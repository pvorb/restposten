var restposten = require('../');
var mem = require('restposten-memory');
var JaySchema = require('jayschema');

restposten.validator = new JaySchema();
mem.connect({
  name : 'restposten_test'
}, function(err, db) {
  if (err)
    throw err;

  restposten.database = db;

  var Author = restposten.define('author', {
    "properties" : {
      "name" : {
        "type" : "string"
      }
    }
  });

  Author.create({
    _id : 'pvorb',
    name : 'Paul'
  }, function(err, bla) {
    Author.create({ _id: 'hadf', name: 'Hans' }, function () {});
    
    Author.all(function(err, result) {
      console.log(err, result.map(function(r) {
        return r.properties;
      }));
    });
  });
});
