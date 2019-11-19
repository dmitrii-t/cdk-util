// Integration test
import {App, CfnOutput, Stack} from '@aws-cdk/core';
import {expect} from 'chai';
import * as sns from '@aws-cdk/aws-sns';
import * as path from 'path';
import {deployStack, describeStack, destroyStack} from "./index";

/**
 * CDK output directory
 */
const CdkOut = path.resolve('cdk.out');

describe('cdk-util-test', () => {
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

  it('should create a stack with topic', should(async () => {
    // When
    const {environment, stack} = await describeStack({name: id, app, exclusively: true});
    const topicArn = stack.Outputs!!.find(it => it.OutputKey === 'TopicArn')!!.OutputValue;

    // Then
    expect(topicArn).to.exist;

    // Return completed promise
    return Promise.resolve();
  }));
});

function should(block: () => Promise<void>) {
  return (done: any) => {
    block()
      .then(() => done())
      .catch(err => done(err));
  };
}
