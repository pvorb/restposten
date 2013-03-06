var persistence = require('..');
var memory = require('persistence-memory');
var JaySchema = require('jayschema');

persistence.validator = new JaySchema;

memory.connect(function(err, engine) {
  persistence.engine = engine;

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

  // create an author
  Author.create({
    "_id" : "pvorb"
  }, function(err, author) {
    if (err)
      throw err;
    console.log(author._id, 'created');

    // create a book
    Book.create({
      "_id" : "some-book",
      "author" : "pvorb"
    }, function(err, book) {
      if (err)
        throw err;

      console.log(book._id, 'created');

      // get the author of this book
      book.getAuthor(function(err, author) {
        if (err)
          throw err;

        console.log(book._id, 'written by', author._id);
      });

      // get all books from this author
      author.getBooks(function(err, books) {
        if (err)
          throw err;

        console.log(author._id, 'wrote:');
        books.forEach(function(book) {
          console.log('  *', book._id);
        })
      });
    });
  });
});
