import {readFile} from "fs";
import {Run} from "./Run";
import {LocalExecutor} from "../exec/Local";

function loadJsonFile(path:string):Promise<any> {
  return new Promise((resolve, reject) => {
    readFile(path, function(err, data) {
      if (err) { return reject(err); }
      try {
        const obj = JSON.parse(data as any);
        resolve(obj);
      } catch(err) {
        reject(err);
      }
    })
  });
}

export class LocalRun extends Run {
  protected refreshTimeout:number = 1000;

  executor(fn:SparksFunction) {
    return new LocalExecutor(fn);
  }
  async loadFunctions():Promise<SparksFunction[]> {
    return await loadJsonFile('services/functions.json');
  }
  async loadSchemas():Promise<any[]> {
    return await loadJsonFile('services/schemas.json');
  }
}