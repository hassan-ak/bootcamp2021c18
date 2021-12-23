# Neptune with Lambda

## Steps to code

1. Create new folder using `mkdir step00_neptune_lambda`
2. Navigate to newly created folder using `cd step00_neptune_lambda`
3. Create cdk app using `cdk init --language typescript`
4. Update "./lib/step00_neptune_lambda-stack.ts" to define virtual private cloud which created subnet IPv4 addresses for our net-working.

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

5. Update "./lib/step00_neptune_lambda-stack.ts" to create security group as AWS neptune requires one. Create a security group and subnetgroup to ensure lambda and neptune cluster deploy on the same vpc

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

6. Update "./lib/step00_neptune_lambda-stack.ts" to create cluster, it is same as creating ddb.

   ```js
   const neptuneCluster = new neptune.CfnDBCluster(this, 'MyCluster', {
     dbSubnetGroupName: neptuneSubnet.dbSubnetGroupName,
     dbClusterIdentifier: 'myDbCluster',
     vpcSecurityGroupIds: [sgl.securityGroupId],
   });
   neptuneCluster.addDependsOn(neptuneSubnet);
   ```

7. Update "./lib/step00_neptune_lambda-stack.ts" to create naptune instance it defines on cloud the configration we want to use

   ```js
   const neptuneInstance = new neptune.CfnDBInstance(this, 'myinstance', {
     dbInstanceClass: 'db.t3.medium',
     dbClusterIdentifier: neptuneCluster.dbClusterIdentifier,
     availabilityZone: vpc.availabilityZones[0],
   });
   neptuneInstance.addDependsOn(neptuneCluster);
   ```

8. Update "./lib/step00_neptune_lambda-stack.ts" to create lambda function

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

9. Update "./lib/step00_neptune_lambda-stack.ts" to output naptune endpoint

   ```js
   import { CfnOutput } from 'aws-cdk-lib';
   new CfnOutput(this, 'Neptune Endpoint', {
     value: neptuneCluster.attrEndpoint,
   });
   ```

10. Update "./lib/step00_neptune_lambda-stack.ts" to create Api gateway

    ```js
    import { aws_apigateway as apigw } from 'aws-cdk-lib';
    const apigateway = new apigw.LambdaRestApi(this, 'api', {
      handler: handler,
    });
    ```

11.
