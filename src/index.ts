import * as core from '@aws-cdk/core';
import {Environment} from '@aws-cdk/core';
import {RequireApproval} from 'aws-cdk/lib/diff';
import {CloudFormation} from 'aws-sdk';
import {Configuration} from 'aws-cdk/lib/settings';
import {CdkToolkit} from 'aws-cdk/lib/cdk-toolkit';
import {AppStacks, DefaultSelection, ExtendedStackSelection, Tag} from 'aws-cdk/lib/api/cxapp/stacks';
import {CloudFormationDeploymentTarget} from 'aws-cdk/lib/api/deployment-target';
import {Mode} from 'aws-cdk/lib/api/aws-auth/credentials';
import {SDK} from 'aws-cdk/lib/api/util/sdk';

const cfn = require('aws-cdk/lib/api/util/cloudformation');

/**
 * CDK context
 */
class CdkContext {

  private readonly config: Configuration;

  private readonly appStacks: AppStacks;

  private readonly cdkToolkit: CdkToolkit;

  private readonly provisioner: CloudFormationDeploymentTarget;

  constructor(private readonly app: core.App,
              private readonly name: string,
              private readonly exclusively: boolean,
              private readonly tags: Tag[] = [],
              private readonly aws: SDK = new SDK({ec2creds: true})) {

    this.config = new Configuration({});

    this.appStacks = new AppStacks({
      configuration: this.config,
      synthesizer: async () => this.app.synth(),
      aws: this.aws,
      ignoreErrors: false,
      verbose: true,
      strict: true,
    });

    this.provisioner = new CloudFormationDeploymentTarget({
      aws: this.aws
    });

    this.cdkToolkit = new CdkToolkit({
      appStacks: this.appStacks,
      provisioner: this.provisioner
    });
  }

  public async deploy() {
    await this.config.load();
    await this.cdkToolkit.deploy({
      stackNames: [this.name],
      exclusively: this.exclusively,
      tags: this.tags,
      sdk: this.aws,
      // roleArn: args.roleArn,
      requireApproval: RequireApproval.Never,
      // ci: args.ci,
      // reuseAssets: args['build-exclude'],
    });
  }

  public async destroy() {
    await this.config.load();
    await this.cdkToolkit.destroy({
      // roleArn: args.roleArn,
      stackNames: [this.name],
      exclusively: this.exclusively,
      sdk: this.aws,
      force: true,
    });
  }

  public async describe(): Promise<CdkStackDescription> {
    await this.config.load();
    const stackList = await this.appStacks.selectStacks([this.name], {
      extend: this.exclusively ? ExtendedStackSelection.None : ExtendedStackSelection.Upstream,
      defaultBehavior: DefaultSelection.OnlySingle
    });

    if (stackList.length === 0) {
      throw Error(`No stacks found by name ${this.name}`);
    }

    const stack = stackList[0];
    const cfnClient = await this.aws.cloudFormation(stack.environment.account, stack.environment.region, Mode.ForWriting);
    const descr = await cfn.describeStack(cfnClient, this.name);
    return {
      environment: {
        account: stack.environment.account,
        region: stack.environment.region
      },
      stack: descr!!,
    };
  }
}

export interface CdkUtilProps {
  app: core.App;
  name: string;
  exclusively: boolean;
}

export interface CdkStackDescription {
  environment: Environment;
  stack: CloudFormation.Stack;
}

export async function deployStack(props: CdkUtilProps) {
  const {app, name, exclusively} = props;

  console.info(`+++ Deploying AWS CDK app ${name} exclusively ${exclusively}`);
  const cdkCtx = await new CdkContext(app, name, exclusively);
  await cdkCtx.deploy();
}

export async function describeStack(props: CdkUtilProps): Promise<CdkStackDescription> {
  const {app, name, exclusively} = props;
  const cdkCtx = await new CdkContext(app, name, exclusively);
  return await cdkCtx.describe();
}

export async function destroyStack(props: CdkUtilProps): Promise<void> {
  const {app, name, exclusively} = props;

  console.info(`--- Destroying AWS CDK app ${name} exclusively ${exclusively}`);
  const cdkCtx = await new CdkContext(app, name, exclusively);
  await cdkCtx.destroy();
}

export function withStack(props: CdkUtilProps, block: (descr: CdkStackDescription) => Promise<void>) {
  return (done: any) => {
    describeStack(props)
      .then(block)
      .then(() => done())
      .catch(err => done(err));
  };
}
