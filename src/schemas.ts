import * as minimatch from 'minimatch';
import * as Ajv from 'ajv';
import {S3} from 'aws-sdk';

export function makeAjv(schemas:any[]) {
  const ajv = Ajv({
    coerceTypes: true
  });

  schemas.forEach(schema => ajv.addSchema(schema));
  return ajv;
}

export async function remoteSchemas() {
  const s3 = new S3();

  const response = await s3.getObject({
    Bucket: process.env['S3_BUCKET'],
    Key: process.env['SCHEMAS_KEY']
  }).promise();

  const schemas = JSON.parse(response.Body as any);
  return makeAjv(schemas);
}

export function getValidatorsFor(ajv, fn:SparksFunction) {
  const schemaPatterns = fn.config.schemas || [];
  const schemas = schemaPatterns
    .reduce((acc, p) =>
      acc.concat(minimatch.match(Object.keys(ajv['_schemas']), p) as any), []
    )
    .map(name => ajv.getSchema(name));
  return schemas;
}
