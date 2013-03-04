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

  var Book = persistence.define('book', {
    "properties" : {
      "id" : {
        "type" : "string"
      },
      "author" : {
        "type" : "string",
        "links" : [ {
          "rel" : "full",
          "href" : "author/{@}"
        } ]
      }
    }
  });

  Author.create({
    "_id" : "pvorb"
  }, function(err, author) {
    if (err)
      throw err;

    console.log(author.id, 'created');
  });

  Book.create({
    "_id" : "some-book",
    "author" : "pvorb"
  }, function(err, book) {
    if (err)
      throw err;

    console.log(book.id, 'created');
  });
});
