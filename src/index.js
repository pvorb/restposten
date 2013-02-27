var persistence = module.exports;

persistence.SchemaInstance = require('./schema_instance').SchemaInstance;
persistence.define         = require('./main').define;
persistence.validator   = require('./main').validator;
persistence.engine      = require('./main').engine;
