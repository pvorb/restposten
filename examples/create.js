var restposten = require('..');
var memory = require('restposten-memory');
var JaySchema = require('jayschema');

var validator = new JaySchema;

memory.connect(function(err, engine) {
  restposten.engine = engine;
  restposten.validator = validator;

  var Author = restposten.define('author', {
    "properties" : {
      "_id" : {
        "type" : "string"
      }
    }
  });

  Author.create({
    _id : 'pvorb'
  }, function(err, author) {
    if (err)
      throw err;

    console.log(author._id);
  });
});
