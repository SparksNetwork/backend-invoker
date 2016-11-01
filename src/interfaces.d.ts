declare interface SparksFunction {
  path:string;
  name:string;
  config:{
    stream?: string;
    schemas?: string[];
  };
}

declare interface StreamRecord {
  streamName: string;
  partitionKey: any;
  data: any;
}

declare interface ClientContext {
  context: 'kafka';
  topic: string;
  partition: number;
}

declare interface Executor {
  exec(message:any, context:ClientContext):Promise<any[]>
}