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
    // "pvorb" exists already in scope from the create

    // We can also re-fetch the resource
    Author.get({
      '_id' : 'pvorb'
    }, function(err, results) {
      console.log(err, results[0].properties);
    });
  });
});
