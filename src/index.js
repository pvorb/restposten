var persistence = module.exports;

persistence.Resource     = require('./resource').Resource;
persistence.define       = require('./main').define;
persistence.setValidator = require('./main').setValidator;
persistence.getValidator = require('./main').getValidator;
persistence.setEngine    = require('./main').setEngine;
persistence.getEngine    = require('./main').getEngine;
