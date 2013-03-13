// the same as in 'references.js', but it makes use of deferred relations

var restposten = require('..');
var memory = require('restposten-memory');
var JaySchema = require('jayschema');

restposten.validator = new JaySchema;

memory.connect(function(err, db) {
  restposten.database = db;

  var Book = restposten.define('book', {
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

  var Author = restposten.define('author', {
    "properties" : {
      "id" : {
        "type" : "string"
      }
    }
  });

  // create an author
  Author.create({
    "_id" : "pvorb"
  }, function(err, author) {
    if (err)
      throw err;
    console.log(author.properties._id, 'created');

    // create a book
    Book.create({
      "_id" : "some-book",
      "author" : "pvorb"
    }, function(err, book) {
      if (err)
        throw err;

      console.log(book.properties._id, 'created');

      // get the author of this book
      book.getAuthor(function(err, author) {
        if (err)
          throw err;

        console.log(book.properties._id, 'written by', author.properties._id);
      });

      // get all books from this author
      author.getBooks(function(err, books) {
        if (err)
          throw err;

        console.log(author.properties._id, 'wrote:');
        books.forEach(function(book) {
          console.log('  *', book.properties._id);
        })
      });
    });
  });
});
