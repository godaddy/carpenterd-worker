
const { DynamoDB } = require('aws-sdk');
const dynamo = require('dynamodb-x');
const AwsLiveness = require('aws-liveness');
const wrhs = require('warehouse-models');

module.exports = function (app, done) {
  const ensure = app.config.get('ensure');
  const region = app.config.get('DATABASE_REGION') || app.config.get('AWS_DEFAULT_REGION');
  const config = app.config.get('database') || {};
  const dynamoDriver = new DynamoDB({
    region,
    ...config
  });

  dynamo.dynamoDriver(dynamoDriver);
  app.models = wrhs(dynamo);
  app.database = dynamo;

  new AwsLiveness().waitForServices({
    clients: [dynamoDriver],
    waitSeconds: 60
  }).then(function () {
    if (!ensure) return done();
    app.models.ensure(done);
  }).catch(done);
};
