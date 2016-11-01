require('source-map-support').install();

import {localSchemas, remoteSchemas, getSchemasFor} from "./schemas";
import {error} from "./log";
import {localFunctions, remoteFunctions} from "./functions";
import {Publisher} from "./Publisher";
import {LambdaExecutor} from "./exec/Lambda";
import {FunctionConsumer} from "./FunctionConsumer";

const argv = process.argv.slice(2);
const [mode] = argv;
const time = Number(argv[1] || 10) * 1000;
const functionsPath = argv[2];
const connectionString = process.env['KAFKA_CONNECTION'];

if (!mode || time < 1 || (mode === 'local' && !functionsPath)) {
  error('[usage] <script> <local or lambda> [config timeout, defaults to 10] <path to functions for local mode>');
  error('example:');
  error('  node invoker.js local 10 dist/functions.json');
  error('example:');
  error('  node invoker.js remote 60');
  process.exit(1);
}

async function lambdaConsumers(publisher) {
  const functions = await remoteFunctions();
  const schemas = await remoteSchemas();

  return functions
    .filter(fn => fn.config.stream)
    .map(function(fn) {
      const exec = new LambdaExecutor(fn);
      return new FunctionConsumer(fn, {
        exec,
        publisher,
        schemas: getSchemasFor(schemas, fn)
      }, {
        connectionString
      });
    });
}

async function localConsumers(publisher) {
  const functions = await localFunctions(functionsPath);
  const schemas = await localSchemas();

  return functions
    .filter(fn => fn.config.stream)
    .map(function(fn) {
      const exec = new LocalExecutor(fn);
      return new FunctionConsumer(fn, {
        publisher,
        exec,
        schemas: getSchemasFor(schemas, fn)
      }, {
        connectionString
      });
    });
}

const makeConsumers = mode === 'lambda' ?
  lambdaConsumers : localConsumers;

async function run(time:number) {
  while (true) {
    const publisher = new Publisher({connectionString});
    await publisher.init();

    const consumers = await makeConsumers(publisher);
    await Promise.all(consumers.map(consumer => consumer.runFor(time)));

    await publisher.end();
  }
}

process.on('unhandledRejection', function(reason, p) {
  error('unhandled rejection');
  error(reason);
  error(p);
  process.exit(1);
});

run(time);