var persistence = module.exports;

// import error types
require('./errors.js');

persistence.SchemaInstance = require('./schema_instance.js').SchemaInstance;
persistence.define         = require('./main.js').define;
persistence.validator      = require('./main.js').validator;
persistence.engine         = require('./main.js').engine;
