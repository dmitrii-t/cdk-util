"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deployStack = deployStack;
exports.destroyStack = destroyStack;

var _diff = require("aws-cdk/lib/diff");

var _settings = require("aws-cdk/lib/settings");

var _cdkToolkit = require("aws-cdk/lib/cdk-toolkit");

var _stacks = require("aws-cdk/lib/api/cxapp/stacks");

var _deploymentTarget = require("aws-cdk/lib/api/deployment-target");

var _credentials = require("aws-cdk/lib/api/aws-auth/credentials");

var _sdk = require("aws-cdk/lib/api/util/sdk");

var cfn = _interopRequireWildcard(require("aws-cdk/lib/api/util/cloudformation"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

async function deployStack(props) {
  const cdkUtil = await CdkUtil.create(props);
  await cdkUtil.deploy();
  return await cdkUtil.describe();
}

async function destroyStack(props) {
  const cdkUtil = await CdkUtil.create(props);
  await cdkUtil.destroy();
}
/** CDK context */


class CdkUtil {
  // Factory method
  static async create(props) {
    const cdkUtil = new CdkUtil(props);
    await cdkUtil.config.load();
    return cdkUtil;
  }

  constructor(props) {
    this.props = props;
    this.aws = new _sdk.SDK({
      ec2creds: true
    });
    this.config = new _settings.Configuration({});
    this.appStacks = new _stacks.AppStacks({
      aws: this.aws,
      configuration: this.config,
      synthesizer: async () => this.props.app.synth(),
      ignoreErrors: false,
      verbose: true,
      strict: true
    });
    this.cdkToolkit = new _cdkToolkit.CdkToolkit({
      provisioner: new _deploymentTarget.CloudFormationDeploymentTarget({
        aws: this.aws
      }),
      appStacks: this.appStacks
    });
  }

  async deploy() {
    const {
      name,
      exclusively
    } = this.props;
    console.info(`+++ Deploying AWS CDK app ${name} exclusively ${exclusively}`);
    await this.cdkToolkit.deploy({
      sdk: this.aws,
      stackNames: [this.props.name],
      exclusively: this.props.exclusively,
      tags: this.props.tags,
      // roleArn: args.roleArn,
      requireApproval: _diff.RequireApproval.Never // ci: args.ci,
      // reuseAssets: args['build-exclude'],

    });
  }

  async destroy() {
    const {
      name,
      exclusively
    } = this.props;
    console.info(`--- Destroying AWS CDK app ${name} exclusively ${exclusively}`);
    await this.cdkToolkit.destroy({
      sdk: this.aws,
      // roleArn: args.roleArn,
      stackNames: [this.props.name],
      exclusively: this.props.exclusively,
      force: true
    });
  }

  async describe() {
    const artifactList = await this.appStacks.selectStacks([this.props.name], {
      extend: this.props.exclusively ? _stacks.ExtendedStackSelection.None : _stacks.ExtendedStackSelection.Upstream,
      defaultBehavior: _stacks.DefaultSelection.OnlySingle
    });

    if (artifactList.length === 0) {
      throw Error(`No stacks found by name ${this.props.name}`);
    }

    const artifact = artifactList[0];
    const cfnClient = await this.aws.cloudFormation(artifact.environment.account, artifact.environment.region, _credentials.Mode.ForWriting);
    return await cfn.describeStack(cfnClient, this.props.name);
  }

}
//# sourceMappingURL=index.js.map