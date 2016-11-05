import {exec} from "child_process";
import {writeFile} from "fs";
import {exists} from "fs";
import {unlink} from "fs";
import {error} from "../log";

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

async function execAsync(cmd):Promise<string> {
  const p = new Promise((resolve, reject) => {
    exec(cmd, (err, stdout) => err ? reject(err) : resolve(stdout))
  });
  return p as Promise<string>
}

export class LocalExecutor implements Executor {
  constructor(private fn:SparksFunction) {
  }

  async exec(message:any, context:ClientContext) {
    const program = `
const message = JSON.parse('${JSON.stringify(message)}');
const context = {clientContext: JSON.parse('${JSON.stringify(context)}')};
const fn = require('./${this.fn.path}');

fn(message, context)
  .then(response => console.log(JSON.stringify({
    success: true,
    response: response
  })
  .catch(error => console.log(JSON.stringify({
    success: false,
    error: error
  });
`;

    const tmpName = await randName(this.fn.name);

    try {
      await new Promise((resolve, reject) => {
        writeFile(tmpName, program, err => err ? reject(err) : resolve());
      });

      const output = await execAsync(`cd services; node ${tmpName}`);
      const result = JSON.parse(output);

      if(result.success) {
        return result.response
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