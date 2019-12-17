import * as core from '@aws-cdk/core';
import {RequireApproval} from 'aws-cdk/lib/diff';
import {CloudFormation} from 'aws-sdk';
import {Configuration} from 'aws-cdk/lib/settings';
import {CdkToolkit} from 'aws-cdk/lib/cdk-toolkit';
import {AppStacks, DefaultSelection, ExtendedStackSelection, Tag} from 'aws-cdk/lib/api/cxapp/stacks';
import {CloudFormationDeploymentTarget} from 'aws-cdk/lib/api/deployment-target';
import {Mode} from 'aws-cdk/lib/api/aws-auth/credentials';
import {SDK} from 'aws-cdk/lib/api/util/sdk';
import * as cfn from 'aws-cdk/lib/api/util/cloudformation';

export interface CdkProps {
  app: core.App;
  name: string;
  exclusively: boolean;
  tags: Tag[];
}

export async function deployStack(props: CdkProps): Promise<CloudFormation.Stack> {
  const {name, exclusively} = props;
  console.info(`+++ Deploying AWS CDK app ${name} exclusively ${exclusively}`);
  const cdkCtx = await CdkContext.create(props);
  await cdkCtx.deploy();
  return await cdkCtx.describe();
}

export async function destroyStack(props: CdkProps): Promise<void> {
  const {name, exclusively} = props;
  console.info(`--- Destroying AWS CDK app ${name} exclusively ${exclusively}`);
  const cdkCtx = await CdkContext.create(props);
  await cdkCtx.destroy();
}

/** CDK context */
class CdkContext {

  // Factory method
  static async create(props: CdkProps): Promise<CdkContext> {
    const cdkCtx = new CdkContext(props);
    await cdkCtx.config.load();
    return cdkCtx;
  }

  private readonly config: Configuration;

  private readonly appStacks: AppStacks;

  private readonly cdkToolkit: CdkToolkit;

  private readonly provisioner: CloudFormationDeploymentTarget;

  private readonly aws: SDK;

  private constructor(private readonly props: CdkProps) {

    this.aws = new SDK({ec2creds: true});

    this.config = new Configuration({});

    this.appStacks = new AppStacks({
      configuration: this.config,
      synthesizer: async () => this.props.app.synth(),
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
    await this.cdkToolkit.deploy({
      stackNames: [this.props.name],
      exclusively: this.props.exclusively,
      tags: this.props.tags,
      sdk: this.aws,
      // roleArn: args.roleArn,
      requireApproval: RequireApproval.Never,
      // ci: args.ci,
      // reuseAssets: args['build-exclude'],
    });
  }

  public async destroy() {
    await this.cdkToolkit.destroy({
      // roleArn: args.roleArn,
      stackNames: [this.props.name],
      exclusively: this.props.exclusively,
      sdk: this.aws,
      force: true,
    });
  }

  public async describe(): Promise<CloudFormation.Stack> {
    const artifactList = await this.appStacks.selectStacks([this.props.name], {
      extend: this.props.exclusively ? ExtendedStackSelection.None : ExtendedStackSelection.Upstream,
      defaultBehavior: DefaultSelection.OnlySingle
    });

    if (artifactList.length === 0) {
      throw Error(`No stacks found by name ${this.props.name}`);
    }

    const artifact = artifactList[0];
    const cfnClient = await this.aws.cloudFormation(
      artifact.environment.account,
      artifact.environment.region,
      Mode.ForWriting);

    return await cfn.describeStack(cfnClient, this.props.name);
  }
}

