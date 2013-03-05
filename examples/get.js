var persistence = require('../');
var mem = require('persistence-memory');
var JaySchema = require('jayschema');

persistence.validator = new JaySchema();
mem.connect({
  name : 'persistence_test'
}, function(err, db) {
  if (err)
    throw err;

  var Author = persistence.define('author', {
    "name" : {
      "type" : "string"
    }
  });

  Author.create({
    _id : 'pvorb',
    name : 'Paul'
  }, function(err, pvorb) {
    //
    // "marak" exists already in scope from the create
    //
    console.log(pvorb);
    //
    // We can also re-fetch the resource
    //
    Author.get({
      '_id' : pvorb._id
    }, function(err, result) {
      console.log(err, result);
    });
  });
});
