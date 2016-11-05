import {Publisher} from "../Publisher";
import {SchemaConsumer} from "../SchemaConsumer";
import {getValidatorsFor, makeAjv} from "../schemas";
import {filter, identity} from'ramda';
import {EventEmitter} from "events";

export class Run extends EventEmitter {
  private publisher:Publisher;
  private consumers:SchemaConsumer[];
  private refreshTimer;
  protected refreshTimeout:number = 60000;

  constructor(private connectionString:string) {
    super();
    this.publisher = new Publisher({connectionString});
  }

  executor(fn:SparksFunction):Executor {
    throw new Error('implement');
  }
  async loadFunctions():Promise<SparksFunction[]> {
    throw new Error('implement');
  }
  async loadSchemas():Promise<any[]> {
    throw new Error('implement');
  }

  async handler(exec:Executor, message:any, topic:string, partition:number) {
    const context:ClientContext = {
      context: "kafka",
      topic,
      partition
    };

    this.emit('message', message, topic, partition);
    const newMessages = await exec.exec(message, context);

    if (newMessages && newMessages.length > 0) {
      await this.publisher.publishMessages(filter<any>(identity, newMessages));
      this.emit('publish', newMessages);
    }
  }

  makeConsumer(fn, ajv) {
    const exec = this.executor(fn);
    const handler = (message, topic, partition) => {
      return this.handler(exec, message, topic, partition);
    };
    return new SchemaConsumer(fn.config.stream, getValidatorsFor(ajv, fn), handler, {
      groupId: fn.name,
      connectionString: this.connectionString
    });
  }

  async makeConsumers() {
    const functions = await this.loadFunctions();
    const schemas = await this.loadSchemas();
    const ajv = makeAjv(schemas);

    return functions
      .filter(fn => fn.config.stream)
      .map(fn => this.makeConsumer(fn, ajv))
  }

  async stop() {
    this.refreshTimer = null;
    if (this.consumers) {
      await Promise.all(this.consumers.map(c => c.end()));
    }
    this.consumers = [];
    this.emit('stop');
  }

  async initConsumers() {
    this.consumers = await this.makeConsumers();
    return Promise.all(this.consumers.map(c => c.init()));
  }

  async refresh() {
    try {
      this.stop();
      this.initConsumers();
      this.refreshTimer = setTimeout(() => this.refresh, this.refreshTimeout);
      this.emit('refresh');
    } catch(err) {
      this.emit('error', err);
      throw err;
    }
  }

  async run() {
    try {
      await this.publisher.init();
      this.initConsumers();
      this.refreshTimer = setTimeout(() => this.refresh, this.refreshTimeout);
      this.emit('run');
    } catch(err) {
      this.emit('error', err);
      throw err;
    }
  }

  async end() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    await this.stop();
    await this.publisher.end();
    this.emit('end');
  }
}
