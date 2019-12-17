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
  const cdkUtil = await CdkUtil.create(props);
  await cdkUtil.deploy();
  return await cdkUtil.describe();
}

export async function destroyStack(props: CdkProps): Promise<void> {
  const cdkUtil = await CdkUtil.create(props);
  await cdkUtil.destroy();
}

/** CDK context */
class CdkUtil {

  // Factory method
  static async create(props: CdkProps): Promise<CdkUtil> {
    const cdkUtil = new CdkUtil(props);
    await cdkUtil.config.load();
    return cdkUtil;
  }

  private readonly aws: SDK;

  private readonly config: Configuration;

  private readonly appStacks: AppStacks;

  private readonly cdkToolkit: CdkToolkit;

  private constructor(private readonly props: CdkProps) {

    this.aws = new SDK({ec2creds: true});

    this.config = new Configuration({});

    this.appStacks = new AppStacks({
      aws: this.aws,
      configuration: this.config,
      synthesizer: async () => this.props.app.synth(),
      ignoreErrors: false,
      verbose: true,
      strict: true,
    });

    this.cdkToolkit = new CdkToolkit({
      provisioner: new CloudFormationDeploymentTarget({
        aws: this.aws
      }),
      appStacks: this.appStacks
    });
  }

  public async deploy() {
    const {name, exclusively} = this.props;
    console.info(`+++ Deploying AWS CDK app ${name} exclusively ${exclusively}`);

    await this.cdkToolkit.deploy({
      sdk: this.aws,
      stackNames: [this.props.name],
      exclusively: this.props.exclusively,
      tags: this.props.tags,
      // roleArn: args.roleArn,
      requireApproval: RequireApproval.Never,
      // ci: args.ci,
      // reuseAssets: args['build-exclude'],
    });
  }

  public async destroy() {
    const {name, exclusively} = this.props;
    console.info(`--- Destroying AWS CDK app ${name} exclusively ${exclusively}`);

    await this.cdkToolkit.destroy({
      sdk: this.aws,
      // roleArn: args.roleArn,
      stackNames: [this.props.name],
      exclusively: this.props.exclusively,
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

