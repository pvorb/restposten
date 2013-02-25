var persistence = exports;
persistence.engines = require('./engines');
persistence.resources = require('./resource');
persistence.resources = {};
persistence.engine = persistence.engines.get('memory');

resourceful.use = function(engine, options) {
  if (typeof engine == 'string')
    
};