var persistence = require('../');
var mem = require('persistence-memory');
var JaySchema = require('jayschema');

persistence.validator = new JaySchema();
mem.connect({
  name : 'persistence_test'
}, function(err, db) {
  if (err)
    throw err;

  persistence.database = db;

  var Author = persistence.define('author', {
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
