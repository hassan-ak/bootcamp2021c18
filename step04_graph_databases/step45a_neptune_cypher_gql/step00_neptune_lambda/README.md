# Neptune with Lambda

## Reading Material

- [Using AWS Lambda functions in Amazon Neptune](https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions.html)
- [The Amazon Neptune openCypher HTTPS endpoint](https://docs.aws.amazon.com/neptune/latest/userguide/access-graph-opencypher-queries.html)

## Steps to code

1. Create new folder using `mkdir step00_neptune_lambda`
2. Navigate to newly created folder using `cd step00_neptune_lambda`
3. Create cdk app using `cdk init --language typescript`
4. run `npm run watch` to auto transpile the code
5. Update "./lib/step00_neptune_lambda-stack.ts" to define virtual private cloud which created subnet IPv4 addresses for our net-working.

   ```js
   import { aws_ec2 as ec2 } from 'aws-cdk-lib';
   const vpc = new ec2.Vpc(this, 'Vpc', {
     subnetConfiguration: [
       {
         cidrMask: 24, // Creates a size /24 IPv4 subnet (a range of 256 private IP addresses) in the VPC
         name: 'Ingress',
         subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
       },
     ],
   });
   ```

6. Update "./lib/step00_neptune_lambda-stack.ts" to create security group as AWS neptune requires one. Create a security group and subnetgroup to ensure lambda and neptune cluster deploy on the same vpc

   ```js
   import { Stack } from 'aws-cdk-lib';
   import { aws_neptune as neptune } from 'aws-cdk-lib';
   const sgl = new ec2.SecurityGroup(this, 'mySecurityGroup', {
     vpc,
     allowAllOutbound: true,
     description: 'Security Group 1',
     securityGroupName: 'mySecurityGroup',
   });
   Tags.of(sgl).add('name', 'mySecurityGroup');
   sgl.addIngressRule(sgl, ec2.Port.tcp(8182), 'MyRule');
   const neptuneSubnet = new neptune.CfnDBSubnetGroup(
     this,
     'neptuneSubnetGroup',
     {
       dbSubnetGroupDescription: 'My Subnet',
       subnetIds: vpc.selectSubnets({
         subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
       }).subnetIds,
       dbSubnetGroupName: 'mysubnetgroup',
     }
   );
   ```

7. Update "./lib/step00_neptune_lambda-stack.ts" to create cluster, it is same as creating ddb.

   ```js
   const neptuneCluster = new neptune.CfnDBCluster(this, 'MyCluster', {
     dbSubnetGroupName: neptuneSubnet.dbSubnetGroupName,
     dbClusterIdentifier: 'myDbCluster',
     vpcSecurityGroupIds: [sgl.securityGroupId],
   });
   neptuneCluster.addDependsOn(neptuneSubnet);
   ```

8. Update "./lib/step00_neptune_lambda-stack.ts" to create naptune instance it defines on cloud the configration we want to use

   ```js
   const neptuneInstance = new neptune.CfnDBInstance(this, 'myinstance', {
     dbInstanceClass: 'db.t3.medium',
     dbClusterIdentifier: neptuneCluster.dbClusterIdentifier,
     availabilityZone: vpc.availabilityZones[0],
   });
   neptuneInstance.addDependsOn(neptuneCluster);
   ```

9. Update "./lib/step00_neptune_lambda-stack.ts" to create lambda function

   ```js
   import { aws_lambda as lambda } from 'aws-cdk-lib';
   const handler = new lambda.Function(this, 'Lambda', {
     functionName: 'lambdafunction',
     runtime: lambda.Runtime.NODEJS_14_X,
     code: new lambda.AssetCode('lambdas'),
     handler: 'index.handler',
     vpc: vpc,
     securityGroups: [sgl],
     environment: {
       NEPTUNE_ENDPOINT: neptuneCluster.attrEndpoint,
     },
     vpcSubnets: {
       subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
     },
   });
   ```

10. Update "./lib/step00_neptune_lambda-stack.ts" to output naptune endpoint

    ```js
    import { CfnOutput } from 'aws-cdk-lib';
    new CfnOutput(this, 'Neptune Endpoint', {
      value: neptuneCluster.attrEndpoint,
    });
    ```

11. Update "./lib/step00_neptune_lambda-stack.ts" to create Api gateway

    ```js
    import { aws_apigateway as apigw } from 'aws-cdk-lib';
    const apigateway = new apigw.LambdaRestApi(this, 'api', {
      handler: handler,
    });
    ```

12. To create lambda handler code create folder `mkdir lambdas` and navigate to it using `cd lambdas`, Use `yarn init --yes` and install dependancies using `yarn add axios` and `yarn add @types/aws-lambda --save-dev`

13. Create "lambdas/index.tsx" to create lambda handler

    ```js
    import axios from 'axios';
    export async function handler() {
      try {
        // creates a person vertex with an age property set to 25
        await axios.post(
          'HTTPS://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher',
          'query=CREATE (n:Person {first_name: "Hassan Ali", last_name: "Khan", age: 25 })'
        );
        // retrieve the person created above and returning its age
        const fetch = await axios.post(
          'HTTPS://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher',
          'query=MATCH (n:Person { last_name:"Khan" }) RETURN n'
        );
        // Console Data
        console.log('RESPONSE', fetch.data);
        return {
          statusCode: 200,
          body: JSON.stringify(fetch.data.results),
        };
      } catch (e) {
        console.log('error', e);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'text/plain' },
          body: 'error occured',
        };
      }
    }
    ```

14. Deploy the app using `cdk deploy`
15. Destroy the app `cdk destroy`
