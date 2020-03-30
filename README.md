### :lollipop: Neat'n'sweet AWS CDK utility functions to Deploy, Describe and Destroy cloud stacks

Install the project locally
```
git clone https://github.com/dmitrii-t/aws-cdk-construct-topic-queue.git
npm install
```

Build the construct and echo handler
```bash
npm run build
```

Create local `.env` file with AWS credentials for your deployment account
```
cat > .env <<EOF
AWS_ACCESS_KEY_ID="<provide your access key id>"
AWS_SECRET_ACCESS_KEY="<privide your scret key>"
AWS_DEFAULT_REGION="<specify default region to deploy>"
EOF
```

Test utility functions
```bash
npm run test
```

Create your stack
```typescript
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
```

Deploy your stack with `deployStack` function
```typescript
await deployStack({name: id, app, exclusively: true});
```

To decommission you stack run `destroyStack`

```typescript
await destroyStack({name: id, app, exclusively: true});
```
