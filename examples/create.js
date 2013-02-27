var persistence = require('../');
var memory = require('persistence-memory');

memory.connect(function (err, engine) {
  persistence.engine = engine;

  var Author = persistence.define('author', {
    "properties": {
      "id": {
        "type": "string"
      }
    }
  });

  Author.create({
    id: 'Paul'
  }, function(err, marak){
    console.log(marak);
  });
});
