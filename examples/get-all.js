var persistence = require('../');
var mem = require('persistence-memory');
var JaySchema = require('jayschema');

persistence.validator = new JaySchema();
mem.connect({
  name : 'persistence_test'
}, function(err, db) {
  if (err)
    throw err;

  persistence.engine = db;

  var Author = persistence.define('author', {
    "name" : {
      "type" : "string"
    }
  });

  Author.create({
    _id : 'pvorb',
    name : 'Paul'
  }, function(err, pvorb) {
    Author.all(function(err, result) {
      console.log(err, result);
    });
  });
});
