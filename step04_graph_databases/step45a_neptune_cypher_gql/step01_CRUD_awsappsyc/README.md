# Neptune with Appsync

## Steps to code

1. Create new folder using `mkdir step01_CRUD_awsappsyc`
2. Navigate to newly created folder using `cd step01_CRUD_awsappsyc`
3. Create cdk app using `npx aws-cdk@1.x init app --language typescript` this will create a project based on cdk v1. As Appsync construct library is in preview for cdk v2. so for the ease of coding use cdk v1.
4. run `npm run watch` to auto transpile the code
5. Update "./lib/step01_CRUD_awsappsyc-stack.ts" to define graphQL api using appSync. install appSync using `npm i @aws-cdk/aws-appsync`

   ```js
   import * as appsync from '@aws-cdk/aws-appsync';
   const api = new appsync.GraphqlApi(this, 'graphlApi', {
     name: 'crudapplication-api',
     schema: appsync.Schema.fromAsset('graphql/schema.gql'),
     authorizationConfig: {
       defaultAuthorization: {
         authorizationType: appsync.AuthorizationType.API_KEY,
       },
     },
   });
   ```

6. Create "graphql/schema.gql" to define schema

   ```gql
   type userType {
     id: ID!
     name: String!
     age: Int!
   }
   type Query {
     allUsers: [userType!]
     getUser(id: ID!): userType
   }
   input userInput {
     name: String!
     age: Int!
   }
   type Mutation {
     createUser(user: userInput!): String
     deleteUser(id: ID!): String
   }
   type Subscription {
     onCreateUser: String @aws_subscribe(mutations: ["createUser"])
     onDeleteUser: String @aws_subscribe(mutations: ["deleteUser"])
   }
   ```

7. Install ec2 using `npm i @aws-cdk/aws-ec2` and update "./lib/step01_CRUD_awsappsyc-stack.ts" to create vpc

   ```js
   import * as ec2 from '@aws-cdk/aws-ec2';
   const vpc = new ec2.Vpc(this, 'crudapplication-vpc');
   ```

8. Update "./lib/step01_CRUD_awsappsyc-stack.ts" to create lambda layers and install lambda using `npm i @aws-cdk/aws-lambda`

   ```js
   import * as lambda from '@aws-cdk/aws-lambda';
   const lambdaLayer = new lambda.LayerVersion(this, 'lambdaLayer', {
     code: lambda.Code.fromAsset('lambda-layers'),
     compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
   });
   ```

9. Create and naviagte to new folder using `mkdir lambda-layers && cd lambda-layers && mkdir nodejs && cd nodejs`. Use `npm init --yes` to creake a package.json file. Install axios and nanoid using `npm i axios@0.22.0` and `npm i nanoid@3.1.28`.

10. Update "./lib/step01_CRUD_awsappsyc-stack.ts" to define lambda function and set lambda as datasource for appsync and resolvers

    ```js
    const userLambda = new lambda.Function(this, 'crudapplication-userLambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: new lambda.AssetCode('lambda/User'),
      handler: 'index.handler',
      currentVersionOptions: {
        retryAttempts: 0,
      },
      timeout: cdk.Duration.minutes(1),
      layers: [lambdaLayer],
      vpc: vpc,
    });
    const userLambda_datasource = api.addLambdaDataSource(
      'userLamdaDataSource',
      userLambda
    );
    userLambda_datasource.createResolver({
      typeName: 'Mutation',
      fieldName: 'createUser',
    });
    userLambda_datasource.createResolver({
      typeName: 'Mutation',
      fieldName: 'deleteUser',
    });
    userLambda_datasource.createResolver({
      typeName: 'Query',
      fieldName: 'allUsers',
    });
    userLambda_datasource.createResolver({
      typeName: 'Query',
      fieldName: 'getUser',
    });
    ```

11. Create "lambda/Type/index.ts" to define types

    ```js
    type User = {
      name: String,
      age: Number,
    };
    export default User;
    ```

12. Create "lambda/index.ts" to define lambda handler code

    ```js
    import createUser from './createUser';
    import deleteUser from './deleteUser';
    import allUsers from './allUsers';
    import getUser from './getUser';
    import User from './type';
    type AppSyncEvent = {
      info: {
        fieldName: string,
      },
      arguments: {
        user: User,
        id: string,
      },
    };
    exports.handler = async (event: AppSyncEvent) => {
      switch (event.info.fieldName) {
        case 'createUser':
          return await createUser(event.arguments.user);
        case 'deleteUser':
          return await deleteUser(event.arguments.id);
        case 'allUsers':
          return await allUsers();
        case 'getUser':
          return await getUser(event.arguments.id);
        default:
          return null;
      }
    };
    ```

13. Create "lambda/createUser.ts" to create new user

    ```js
    import User from './type';
    const axios = require('axios');
    const url = 'https://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher';
    const { nanoid } = require('nanoid');
    async function createUser(user: User) {
      let query = `CREATE (:user {id: '${nanoid()}', name: '${
        user.name
      }', age: ${user.age}})`;
      try {
        await axios.post(url, `query=${query}`);
        return user.name;
      } catch (err) {
        console.log('ERROR', err);
        return null;
      }
    }
    export default createUser;
    ```

14. Create "lambda/allUsers.ts" to list all users

    ```js
    const axios = require('axios');
    const url = 'https://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher';
    async function allUsers() {
      let query = `MATCH (n:user) RETURN n`;
      try {
        const fetch = await axios.post(url, `query=${query}`);
        const result = JSON.stringify(fetch.data.results);
        const data = JSON.parse(result);
        let modifiedData = Array();
        for (const [i, v] of data.entries()) {
          //for each vertex
          let obj = {
            id: data[i].n['~id'],
            ...data[i].n['~properties'],
          };
          modifiedData.push(obj);
        }
        return modifiedData;
      } catch (err) {
        console.log('ERROR', err);
        return null;
      }
    }
    export default allUsers;
    ```

15. Create "lambda/getUser.ts" to get one user

    ```js
    const axios = require('axios');
    const url = 'https://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher';
    async function getUser(id: string) {
      let query = `MATCH (n:user {id: '${id}'}) RETURN n`;
      try {
        const fetch = await axios.post(url, `query=${query}`);
        const result = JSON.stringify(fetch.data.results);
        const data = JSON.parse(result);
        let modifiedData = {
          id: data[0].n['~id'],
          ...data[0].n['~properties'],
        };
        return modifiedData;
      } catch (err) {
        console.log('ERROR', err);
        return null;
      }
    }
    export default getUser;
    ```

16. Create "lambda/deleteUser.ts" to delete User

    ```js
    const axios = require('axios');
    const url = 'https://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher';
    async function deleteUser(id: string) {
      let query = `MATCH (n: user {id: '${id}'}) DETACH DELETE n`;
      try {
        await axios.post(url, `query=${query}`);
        return id;
      } catch (err) {
        console.log('ERROR', err);
        return null;
      }
    }
    export default deleteUser;
    ```

17. Create "lambda/Type/index.ts" to define types
18. Create "lambda/Type/index.ts" to define types
19. Create "lambda/Type/index.ts" to define types
20. Create "lambda/Type/index.ts" to define types

21. Update "./lib/step01_CRUD_awsappsyc-stack.ts" to create cluster, it is same as creating ddb. Install neptune sung `npm i @aws-cdk/aws-neptune`

    ```js
    import * as neptune from '@aws-cdk/aws-neptune';
    const cluster = new neptune.DatabaseCluster(
      this,
      'crudapplication-database',
      {
        vpc: vpc,
        instanceType: neptune.InstanceType.T3_MEDIUM,
      }
    );
    ```

22. Update "./lib/step01_CRUD_awsappsyc-stack.ts" to create connection, endpoint and set env variables

    ```js
    cluster.connections.allowDefaultPortFromAnyIpv4('Open to the world');
    const NEPTUNE_ENDPOINT = cluster.clusterEndpoint.hostname;
    userLambda.addEnvironment('NEPTUNE_ENDPOINT', NEPTUNE_ENDPOINT);
    ```

23. Deploy the app using `npm run cdk deploy`
24. Destroy the app `npm run cdk destroy`
