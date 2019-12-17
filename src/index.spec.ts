// Acceptance test
import {App, CfnOutput, Stack} from '@aws-cdk/core';
import {expect} from 'chai';
import * as sns from '@aws-cdk/aws-sns';
import * as path from 'path';
import {deployStack, destroyStack} from "./index";
import * as AWS from 'aws-sdk';

/**
 * CDK output directory
 */
const CdkOut = path.resolve('cdk.out');

describe(`given cdk stack which creates an aws resource such as sns topic`, () => {
  /**
   * Stack to deploy the construct for tests
   */
  class CdkUtilTest extends Stack {
    constructor(scope: App, id: string = CdkUtilTest.name) {
      super(scope, id);

      const topic = new sns.Topic(this, 'Topic');

      // Outputs
      new CfnOutput(this, 'TopicArn', {value: topic.topicArn});
    }
  }

  const id = 'CdkUtilTest';
  const app = new App({outdir: CdkOut});
  const stack = new CdkUtilTest(app, id);

  let topicArn: string;

  // Setup task
  before(async () => {
    const stack = await deployStack({name: id, app, exclusively: true, tags: []});
    topicArn = stack.Outputs!!.find(it => it.OutputKey === 'TopicArn')!!.OutputValue;
  });

  // Cleanup task
  after(async () => {
    await destroyStack({name: id, app, exclusively: true, tags: []});
  });

  describe(`when the stack is created`, () => {
    // --
    it(`then the stack output topicArn should exist`, async () => {
      expect(topicArn).to.exist;
    });

    it('then we should be able to publish a message to the topic successfully', async () => {
      AWS.config.update({region: 'us-west-2'});
      const snsClient = new AWS.SNS();

      expect(async () => {
        await snsClient.publish({TopicArn: topicArn, Message: "test message"}).promise()
      }).to.not.throw();
    });
  });
});

