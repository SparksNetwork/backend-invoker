import {flatten} from 'ramda';
import {Lambda} from "aws-sdk";
import {error} from "../log";

export class LambdaExecutor implements Executor {
  private lambda:Lambda;

  constructor(private fn:SparksFunction) {
    this.lambda = new Lambda({
      region: process.env['AWS_REGION']
    });
  }

  async exec(message:any, context:ClientContext):Promise<any[]> {
    const response = await this.lambda.invoke({
      Payload: JSON.stringify(message),
      ClientContext: new Buffer(JSON.stringify(context)).toString('base64'),
      FunctionName: `sparks_${this.fn.name}`,
      InvocationType: 'RequestResponse'
    }).promise();

    if (response.FunctionError) {
      error(this.fn.name, 'error', response);
      throw new Error(response.Payload ? response.Payload.toString() : 'Unknown error');
    }

    return flatten([JSON.parse(response.Payload as any)]);
  }
}