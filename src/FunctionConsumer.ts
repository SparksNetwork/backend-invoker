import {GroupConsumer} from "no-kafka";
import {RoundRobinAssignment} from "no-kafka";
import {filter, identity} from 'ramda';
import {error, debug} from "./log";
import {Publisher} from "./Publisher";
import {Kafka} from "no-kafka";

interface Schema {
  (message:any):boolean;
}

interface FunctionConsumerOptions {
  schemas: Schema[];
  publisher: Publisher;
  exec: Executor;
}

/**
 * Implementing classes take an ApexFunction and consume messages from the
 * kafka topics for that ApexFunction that match the schemas.
 */
export class FunctionConsumer {
  private consumer:GroupConsumer;
  private schemas:Schema[];
  private publisher:Publisher;
  private exec:Executor;

  constructor(protected fn:SparksFunction, protected options:FunctionConsumerOptions, protected consuemerOptions?:Kafka.GroupConsumerOptions) {
    if (!fn.config.stream) {
      throw new Error(`The function ${fn.name} does not have a stream specified`);
    }

    this.schemas = options.schemas;
    this.publisher = options.publisher;
    this.exec = options.exec;
  }

  private async messageHandler(message, topic, partition) {
    const context:ClientContext = {
      context: "kafka",
      topic,
      partition
    };

    return this.exec.exec(message, context);
  }

  private async rawMessageHandler(rawMessage, topic, partition) {
    const fnStart = Date.now();

    const offset: Kafka.CommitOffset = {
      topic,
      partition,
      offset: rawMessage.offset
    };

    let message;

    try {
      message = JSON.parse(rawMessage.message.value);
    } catch(err) {
      error(this.fn.name, 'error parsing message on topic', topic, partition);
      error(err);
      error(rawMessage);
      return this.consumer.commitOffset(offset);
    }

    if (this.schemas.length === 0 || this.schemas.every(schema => !schema(message))) {
      return this.consumer.commitOffset(offset);
    }

    let start = Date.now();
    const newMessages = await this.messageHandler(message, topic, partition);
    debug(this.fn.name, 'execution time', Date.now() - start);

    if (newMessages && newMessages.length > 0) {
      await this.publisher.publishMessages(filter<any>(identity, newMessages));
    }
    debug(this.fn.name, 'total time', Date.now() - fnStart);

    return this.consumer.commitOffset(offset);
  }

  private async dataHandler(rawMessages, topic, partition) {
    return Promise.all(rawMessages.map(rawMessage =>
      this.rawMessageHandler(rawMessage, topic, partition)));
  }

  async runFor(time:number) {
    this.consumer = new GroupConsumer(Object.assign({}, {
      clientId: 'invoker',
      groupId: this.fn.name,
      idleTimeout: 100,
    }, this.consuemerOptions));

    await this.consumer.init({
      strategy: 'ConsumerStrategy',
      subscriptions: [this.fn.config.stream as string],
      fn: RoundRobinAssignment,
      handler: this.dataHandler.bind(this)
    });

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.consumer.end()
          .then(() => resolve())
          .catch(reject)
      }, time)
    });
  }
}

