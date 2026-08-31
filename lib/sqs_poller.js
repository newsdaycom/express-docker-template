/**
 * Legacy/drain-only SQS polling helper for services that consume old messages.
 *
 * Purpose:
 *   Provides a reusable poller and message wrapper that generated services may
 *   keep temporarily when they need to drain existing AWS SQS messages during a
 *   migration. New queue behavior should use Redis Streams/Valkey helpers.
 *
 * Environment:
 *   ENV selects the queue URL from the configured `queues` map. AWS credentials
 *   and region are resolved by the AWS SDK from the normal runtime environment.
 *   This helper should not be used to publish new SQS messages.
 *
 * Side Effects:
 *   Creates an AWS SQS client, schedules polling timers, calls SQS receive,
 *   delete, and visibility APIs, and executes caller-provided task functions.
 */

import { SQS } from 'aws-sdk';
import async, { asyncify } from 'async';

/**
 * @typedef {object} SQSPollerConfig
 * @property {{local: string, stage: string, prod: string}} queues Queue URLs keyed by deployment environment.
 * @property {number} emptyTimeout Milliseconds to wait after an empty SQS response.
 * @property {number} timeout Milliseconds to wait after processing a non-empty SQS response.
 * @property {number} messagesPerPoll Maximum messages requested from SQS in each receive call.
 * @property {number} concurrentOps Maximum task functions to run at the same time.
 */

/**
 * Build a queue poller that receives SQS messages and passes them to registered
 * task handlers.
 *
 * @constructor
 * @param {Partial<SQSPollerConfig>} [config={}] Configuration overrides for queue polling.
 * @returns {void}
 * @sideEffects Creates an AWS SQS client and stores task/timer state on the instance.
 */
export function SQS_Poller(config = {}) {
  const sqs = new SQS();

  this.config = {
    queues: {
      local: '',
      stage: '',
      prod: ''
    },
    emptyTimeout: 2 * 60 * 1000, // 2 minutes when the response is empty
    timeout: 10 * 1000, // 10 seconds when the response is not empty
    messagesPerPoll: 10,
    concurrentOps: 5,
    ...config // override defaults with any provided config
  };

  this.tasks = [];

  /**
   * Add a task to be run after receiving messages.
   *
   * @param {(messages: Message[]) => Promise<void>|void} task Task that receives wrapped SQS messages.
   * @returns {SQS_Poller} Current poller instance for chaining.
   */
  this.addTask = task => {
    this.tasks.push(task);
    return this;
  };

  /**
   * Update the poller configuration.
   *
   * @param {Partial<SQSPollerConfig>} config Configuration values to shallow merge into the current settings.
   * @returns {SQS_Poller} Current poller instance for chaining.
   */
  this.setConfig = config => {
    this.config = { ...this.config, ...config };
    return this;
  };

  /**
   * Receive one batch of messages, execute registered tasks, and schedule the
   * next poll based on whether the queue returned messages.
   *
   * @returns {Promise<boolean|void>} False when no messages are found; otherwise resolves after tasks are scheduled.
   * @sideEffects Calls AWS SQS, logs queue state, runs task callbacks, and updates timeout handles.
   */
  this.getMessages = async () => {
    // Clear any previous timeout before scheduling the next polling cycle.
    clearTimeout(this.repollTimeout);

    const { Messages } = await sqs
      .receiveMessage({
        QueueUrl: this.config.queues[process.env.ENV],
        MaxNumberOfMessages: this.config.messagesPerPoll
      })
      .promise();

    if (!Messages || Messages.length === 0) {
      // Empty queues poll less frequently to avoid needless local and AWS work.
      console.log('No messages found');
      this.repollTimeout = setTimeout(
        this.getMessages,
        this.config.emptyTimeout
      );
      return false;
    }

    const messages = Messages.map(
      m =>
        new Message({
          message: m,
          sqs,
          queueUrl: this.config.queues[process.env.ENV]
        })
    );

    await async.eachLimit(
      this.tasks,
      this.config.concurrentOps,
      asyncify(async task => {
        try {
          await task(messages);
          return true;
        } catch (e) {
          console.error('>> ERROR RUNNING TASK LIST', e.message);
          return false;
        }
      })
    );

    this.repollTimeout = setTimeout(this.getMessages, this.config.timeout);
    return true;
  };
}

/**
 * Wrap an SQS message with helpers for body parsing, deletion, requeueing, and
 * visibility-timeout management.
 *
 * @constructor
 * @param {object} options Message wrapper dependencies.
 * @param {import('aws-sdk/clients/sqs').Message} options.message Raw SQS message.
 * @param {SQS} options.sqs AWS SQS client used for message actions.
 * @param {string} options.queueUrl Queue URL that produced the message.
 * @returns {void}
 * @sideEffects Stores the raw message and may schedule visibility-extension intervals.
 */
export function Message({ message, sqs, queueUrl }) {
  this.message = message;
  this.sqs = sqs;
  this.queueUrl = queueUrl;
  let { Body } = this.message;
  const { ReceiptHandle } = this.message;

  /**
   * Delete the message after successful processing.
   *
   * @returns {Promise<import('aws-sdk').AWSError|object>} AWS SDK delete result.
   * @sideEffects Clears visibility-extension interval and calls SQS DeleteMessage.
   */
  this.delete = () => {
    clearInterval(this.messageVisibilityInterval);
    return sqs
      .deleteMessage({
        QueueUrl: this.queueUrl,
        ReceiptHandle: this.message.ReceiptHandle
      })
      .promise();
  };

  /**
   * Stop extending visibility so SQS can make the message available again.
   *
   * @returns {void}
   * @sideEffects Clears the visibility-extension interval.
   */
  this.requeue = () => {
    clearInterval(this.messageVisibilityInterval);
  };

  /**
   * Parse and return the JSON message body while keeping the message invisible
   * during processing.
   *
   * @returns {object|string|undefined} Parsed JSON body when present.
   * @throws {SyntaxError} When the message body is present but not valid JSON.
   * @sideEffects Starts an interval that extends SQS message visibility.
   */
  this.getMessage = () => {
    clearInterval(this.messageVisibilityInterval);
    this.messageVisibilityInterval = setInterval(() => {
      sqs.changeMessageVisibility({
        QueueUrl: this.queueUrl,
        ReceiptHandle,
        VisibilityTimeout: 30
      });
    }, 27 * 1000);

    if (Body) {
      Body = JSON.parse(Body);
    }

    return Body;
  };
}

/**
 * Default poller instance for simple services that only need one SQS consumer.
 *
 * @type {SQS_Poller}
 */
const sqs_poller = new SQS_Poller();

export default sqs_poller;

/**
 * Example usage for generated services that keep the optional SQS poller.
 *
 * @example
 * function run() {
 *   sqs_poller.addTask(messages => {
 *     messages.forEach(message => {
 *       try {
 *         const messageBody = message.getMessage();
 *         console.log('Message body', messageBody);
 *         message.delete();
 *       } catch (e) {
 *         message.requeue();
 *       }
 *     });
 *   });
 *
 *   sqs_poller.getMessages();
 * }
 */
