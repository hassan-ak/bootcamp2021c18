import { CfnOutput, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_neptune as neptune } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_apigateway as apigw } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class Step00NeptuneLambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
      subnetConfiguration: [
        {
          cidrMask: 24, // Creates a size /24 IPv4 subnet (a range of 256 private IP addresses) in the VPC
          name: 'Ingress',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create a security group and subnetgroup to ensure lambda and neptune cluster deploy on the same vpc
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

    // Creating Naptune cluster
    const neptuneCluster = new neptune.CfnDBCluster(this, 'MyCluster', {
      dbSubnetGroupName: neptuneSubnet.dbSubnetGroupName,
      dbClusterIdentifier: 'myDbCluster',
      vpcSecurityGroupIds: [sgl.securityGroupId],
    });
    neptuneCluster.addDependsOn(neptuneSubnet);

    // Creating Naptune Instance
    const neptuneInstance = new neptune.CfnDBInstance(this, 'myinstance', {
      dbInstanceClass: 'db.t3.medium',
      dbClusterIdentifier: neptuneCluster.dbClusterIdentifier,
      availabilityZone: vpc.availabilityZones[0],
    });
    neptuneInstance.addDependsOn(neptuneCluster);

    // Lambda function
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

    // Endpoint Output
    new CfnOutput(this, 'Neptune Endpoint', {
      value: neptuneCluster.attrEndpoint,
    });

    // Api gateway
    const apigateway = new apigw.LambdaRestApi(this, 'api', {
      handler: handler,
    });
  }
}
