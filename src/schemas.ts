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

export function getValidatorsFor(ajv, fn:SparksFunction) {
  const schemaPatterns = fn.config.schemas || [];
  const schemas = schemaPatterns
    .reduce((acc, p) =>
      acc.concat(minimatch.match(Object.keys(ajv['_schemas']), p) as any), []
    )
    .map(name => ajv.getSchema(name));
  return schemas;
}
