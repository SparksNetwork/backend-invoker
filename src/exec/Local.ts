import {writeFile} from "fs";
import {exists} from "fs";
import {unlink} from "fs";
import {error, info} from "../log";
import {fork} from "child_process";
import {flatten} from 'ramda';

async function randName(name:string):Promise<string> {
  const r = Math.random() * 10000;
  const f = `${name}${r}.js`;

  const p = new Promise((resolve) => {
    exists(f, function(e) {
      if (e) { resolve(randName(name)) }
      resolve(f);
    })
  });

  return p as Promise<string>;
}

export class LocalExecutor implements Executor {
  constructor(private fn:SparksFunction) {
  }

  async exec(message:any, context:ClientContext) {
    const program = `
require('source-map-support').install();
process.chdir('./services');
const fn = require('./services/${this.fn.path}/index').default;

process.on('disconnected', function() {
  process.exit();
});

process.on('message', function(msg) {
  const message = msg.message;
  const context = msg.context;
  
  fn(message, context, function(err, response) {
    process.send({
      success: !err,
      error: err,
      response: response
    });
  });
});
`;

    const tmpName = await randName(this.fn.name);

    try {
      await new Promise((resolve, reject) => {
        writeFile(tmpName, program, err => err ? reject(err) : resolve());
      });

      const result = await new Promise(function(resolve, reject) {
        const cp = fork(tmpName);
        let done = false;

        cp.on('message', function (msg) {
          resolve(msg);
          done = true;
          cp.disconnect();
        });

        cp.on('disconnected', function() {
          if (!done) {
            reject('child disconnected');
          }
        });

        cp.send({
          message,
          context: {clientContext: context}
        });
      }) as any;

      info('execution result', result);

      if(result.success) {
        return flatten(result.response || []);
      } else {
        error(result);
        throw new Error(result.error);
      }
    } finally {
      await new Promise((resolve) => {
        unlink(tmpName, () => resolve());
      })
    }
  }
}