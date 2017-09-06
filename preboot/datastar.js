const Datastar = require('datastar');
const models = require('warehouse-models');

module.exports = function databoot(app, next) {
  const ensure = app.config.get('ensure') || app.get('ensure');

  app.datastar = new Datastar(app.config.get('datastar') || app.get('datastar'));
  app.models = models(app.datastar);

  if (!ensure) return app.datastar.connect(next);
  app.datastar.connect(err => {
    if (err) return next(err);
    app.models.ensure(next);
  });
};
