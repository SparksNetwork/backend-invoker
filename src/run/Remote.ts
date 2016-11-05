import {S3} from 'aws-sdk';
import {LambdaExecutor} from "../exec/Lambda";
import {Run} from "./Run";

async function loadS3JsonFile(bucket:string, key:string):Promise<any> {
  const s3 = new S3();

  const response = await s3.getObject({
    Bucket: bucket,
    Key: key
  }).promise();

  return JSON.parse(response.Body as any);
}

export class LambdaRun extends Run {
  executor(fn:SparksFunction) {
    return new LambdaExecutor(fn);
  }
  async loadFunctions():Promise<SparksFunction[]> {
    return await loadS3JsonFile(process.env['S3_BUCKET'], process.env['SCHEMAS_KEY']);
  }
  async loadSchemas():Promise<any[]> {
    return await loadS3JsonFile(process.env['S3_BUCKET'],process.env['FUNCTIONS_KEY']);
  }
}