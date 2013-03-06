var persistence = require('..');
var memory = require('persistence-memory');
var JaySchema = require('jayschema');

var validator = new JaySchema;

memory.connect(function(err, engine) {
  persistence.engine = engine;
  persistence.validator = validator;

  var Author = persistence.define('author', {
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
