var persistence = require('..');
var memory = require('persistence-memory');
var JaySchema = require('jayschema');

var validator = new JaySchema();

memory.connect(function(err, engine) {
  persistence.engine = engine;
  persistence.validator = validator;

  var Author = persistence.define('author', {
    "properties" : {
      "id" : {
        "type" : "string"
      }
    }
  });

  Author.create({
    id : 'Paul'
  }, function(err, author) {
    if (err)
      throw err;

    console.log(author.id);
  });
});
