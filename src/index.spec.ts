// Acceptance test
import {App, CfnOutput, Stack} from '@aws-cdk/core';
import {expect} from 'chai';
import * as sns from '@aws-cdk/aws-sns';
import * as path from 'path';
import {deployStack, destroyStack, withStack} from "./index";
import * as AWS from 'aws-sdk';

/**
 * CDK output directory
 */
const CdkOut = path.resolve('cdk.out');

describe('given cdk stack which creates an aws resource such as sns topic', () => {
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

  // Setup task
  before(async () => {
    await deployStack({name: id, app, exclusively: true});
  });

  // Cleanup task
  after(async () => {
    await destroyStack({name: id, app, exclusively: true});
  });

  it('should return arn of the topic', withStack({name: id, app, exclusively: true}, async ({environment, stack}) => {
    // When
    const topicArn = stack.Outputs!!.find(it => it.OutputKey === 'TopicArn')!!.OutputValue;

    AWS.config.update({region: 'us-west-2'});
    const snsClient = new AWS.SNS();

    // Then
    expect(topicArn).to.exist;
    expect(async () => {
      await snsClient.publish({TopicArn: topicArn, Message: "test message"}).promise()
    }).to.not.throw();
  }));
});

