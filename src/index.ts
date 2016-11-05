require('source-map-support').install();

import {error, info, debug} from "./log";
import {LocalRun} from "./run/Local";
import {LambdaRun} from "./run/Remote";

const argv = process.argv.slice(2);

let connectionString = process.env['KAFKA_CONNECTION'];

// If there is a docker link then use that
if (process.env['KAFKA_PORT_9092_TCP_ADDR']) {
  connectionString = process.env['KAFKA_PORT_9092_TCP_ADDR'] + ':9092';
}

process.on('unhandledRejection', function(reason, p) {
  error('unhandled rejection');
  error(reason);
  error(p);
  process.exit(1);
});

let runner;
if (argv[0] === 'local') {
  runner = new LocalRun(connectionString);
} else {
  runner = new LambdaRun(connectionString);
}

runner.on('error', function(error) {
  error('An error occurred in runner');
  error(error);
  process.exit(1);
});

runner.on('refresh', function() {
  info('Refresh');
});

runner.on('end', function() {
  info('ended');
  process.exit();
});

runner.on('run', function() {
  info('Started');
  info('Kafka: ', connectionString);
});

runner.on('message', function(_, topic) {
  info('Message received on', topic);
});

runner.run()
  .catch(function(error) {
    error(error);
    process.exit(1);
  });

process.on('SIGINT', function() {
  console.log('caught int');
  runner.end();
});
process.on('SIGTERM', function() {
  console.log('caught term');
  runner.end();
});
