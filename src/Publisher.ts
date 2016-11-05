import {Producer} from "no-kafka";
import farmhash = require("farmhash");
import {debug} from "./log";
import {Kafka} from "no-kafka";

function farmhashPartitioner(topic:string, partitions:Kafka.PartitionInfo[], message) {
  const hash = farmhash.hash32(message.key);
  const index = hash % partitions.length;
  return partitions[index].partitionId;
}

export class Publisher {
  private producer:Producer;

  constructor(options) {
    const producerOptions = Object.assign({}, {
      clientId: 'invoker',
      partitioner: farmhashPartitioner
    }, options);

    this.producer = new Producer(producerOptions);
  }

  init() {
    return this.producer.init();
  }

  end() {
    return this.producer.end();
  }

  publishMessages(messages:StreamRecord[]) {
    debug('publishing', messages);

    const topicMessages = messages.map(message => {
      return {
        topic: message.streamName,
        message: {
          key: message.partitionKey,
          value: JSON.stringify(message.data)
        }
      }
    });

    return this.producer.send(topicMessages);
  }

  publishMessage(message:StreamRecord) {
    return this.publishMessages([message]);
  }
}
