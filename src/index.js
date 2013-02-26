var persistence = module.exports;

persistence.Schema       = require('./schema').Schema;
persistence.define       = require('./main').define;
persistence.getValidator = require('./main').getValidator;
persistence.setValidator = require('./main').setValidator;
persistence.getEngine    = require('./main').getEngine;
persistence.setEngine    = require('./main').setEngine;
