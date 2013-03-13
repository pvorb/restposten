var restposten = require('../');
var mem = require('restposten-memory');
var JaySchema = require('jayschema');

restposten.validator = new JaySchema;
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
  }, function(err, pvorb) {
    // "pvorb" exists already in scope from the create

    // We can also re-fetch the resource
    Author.getOne({
      '_id' : 'pvorb'
    }, function(err, result) {
      console.log(err, result.properties);
    });
  });
});
