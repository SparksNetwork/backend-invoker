import {S3} from 'aws-sdk';
import {readFile} from "fs";

export async function remoteFunctions():Promise<SparksFunction[]> {
  const s3 = new S3();
  const functionsObj = await s3.getObject({
    Bucket: process.env['S3_BUCKET'],
    Key: process.env['FUNCTIONS_KEY']
  }).promise();

  return JSON.parse(functionsObj.Body as any);
}

export function localFunctions():Promise<SparksFunction[]> {
  return new Promise((resolve, reject) => {
    readFile('functions.json', function (err, data) {
      if (err) {
        return reject(err);
      }
      resolve(JSON.parse(data as any));
    })
  });
}