import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { AccountNumbers } from "./accountNumbers"; // Import your AccountNumbers class

const organizationId = "o-m4vdlthei3"; // Replace with your actual AWS Organization ID
const accountroot    = "039612852088"; // Replace with your actual AWS Account ID

const provider = new aws.Provider("euCentralProvider", {
    region: "eu-west-1",
    accessKey: process.env.AWS_ACCESS_KEY_ID, 
    secretKey: process.env.AWS_SECRET_ACCESS_KEY, 
});

// CloudWatch Logs group to store CloudTrail logs
const cloudTrailLogGroup = new aws.cloudwatch.LogGroup("cloudTrailLogGroup", {
    retentionInDays: 90,
}, { provider });

// SNS Topic for sending notifications
const snsTopic = new aws.sns.Topic("lykee-cloudTrail-Alarm-Topic");

// Subscription to SNS topic (modify with your email or other endpoint)
const snsSubscription = new aws.sns.TopicSubscription("snsSubscription", {
    topic: snsTopic.arn,
    protocol: "email",
    endpoint: "anascloudaws@gmail.com", // Replace with your actual email
}, { provider });

// Mapping through the AccountNumbers class
const accountMapping = {
    dev: AccountNumbers.dev,
    test: AccountNumbers.test,
    prod: AccountNumbers.prod,
    sandbox: AccountNumbers.sandbox,
    reporting: AccountNumbers.reporting,
    xmmtest: AccountNumbers.xmmtest,
    xmmprod: AccountNumbers.xmmprod,
    xmmdev: AccountNumbers.xmmdev,
    logging: AccountNumbers.logging,
    root: AccountNumbers.root,
};

// Loop through the accounts and create resources dynamically
Object.entries(accountMapping).forEach(([env, accountId]) => {
    // Metric Filter for each account, pattern including the account ID
    const metricFilter = new aws.cloudwatch.LogMetricFilter(`${env}MetricFilter`, {
        logGroupName: cloudTrailLogGroup.name,
        //pattern: `{ $.userIdentity.accountId = "${accountId}" && $.userIdentity.type = "Root" }`, 
        pattern: `{ $.userIdentity.type = "Root" && $.userIdentity.invokedBy NOT EXISTS && $.userIdentity.accountId = "${accountId}" }`,
        metricTransformation: {
            name: `${env}RootUsage`,
            namespace: "CloudTrailMetrics",
            value: "1",
        },
    }, { provider });

    // CloudWatch Alarm for each environment
    new aws.cloudwatch.MetricAlarm(`${env}RootUsageAlarm`, {
        name: `${env}RootActivityAlarm`,  // Using the key (env) in the alarm name
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        evaluationPeriods: 1,
        metricName: metricFilter.metricTransformation.name,
        namespace: metricFilter.metricTransformation.namespace,
        period: 60, // Period in seconds
        statistic: "Sum",
        threshold: 1,
        alarmActions: [snsTopic.arn],
        alarmDescription: `Alarm when root activity is detected for ${env} environment.`,
    }, { provider });
});

// Create the IAM Role for CloudTrail to write to CloudWatch Logs
const cloudTrailCWLogsRole = new aws.iam.Role("cloudTrailCWLogsRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "cloudtrail.amazonaws.com" }),
}, { provider });

// IAM Role attachment for CloudTrail to publish logs to CloudWatch
const cloudTrailLogRoleAttachment = new aws.iam.RolePolicyAttachment("cloudTrailLogPolicyAttachment", {
    role: cloudTrailCWLogsRole.name,
    policyArn: aws.iam.ManagedPolicy.CloudWatchLogsFullAccess,
}, { provider });

// Create the CloudTrail
const cloudTrail = new aws.cloudtrail.Trail("organizationTrail", {
    isOrganizationTrail: true,
    s3BucketName: "cloudtrailbukcherorganas",  // Assuming the bucket already exists
    cloudWatchLogsGroupArn: pulumi.interpolate `${cloudTrailLogGroup.arn}:*`,
    cloudWatchLogsRoleArn: cloudTrailCWLogsRole.arn,
    includeGlobalServiceEvents: true,
    isMultiRegionTrail: true,
}, { provider });

// Allow CloudTrail to write to CloudWatch Logs
const cloudTrailLogRolePolicy = new aws.iam.RolePolicy("cloudTrailLogRolePolicy", {
    name: "lykee-cloudtrail-policy",
    role: cloudTrailCWLogsRole.name,  // Use the role name, not the ARN
    policy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AWSCloudTrailCreateLogStream",
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogStream"
                ],
                "Resource": [
                    "arn:aws:logs:eu-west-1:039612852088:log-group:${cloudTrailLogGroup.name}:log-stream::log-stream:039612852088_CloudTrail_eu-west-1*",
                    "arn:aws:logs:eu-west-1:039612852088:log-group:${cloudTrailLogGroup.name}:log-stream:${organizationId}_*"
                ]
            },
            {
                "Sid": "AWSCloudTrailPutLogEvents",
                "Effect": "Allow",
                "Action": [
                    "logs:PutLogEvents"
                ],
                "Resource": [
                    "arn:aws:logs:eu-west-1:${accountroot}:log-group:${cloudTrailLogGroup.name}:log-stream::log-stream:039612852088_CloudTrail_eu-west-1*",
                    "arn:aws:logs:eu-west-1:${accountroot}:log-group:${cloudTrailLogGroup.name}:log-stream:${organizationId}_*"
                ]
            }
        ]
    }`,
}, { provider });



// Lambda Role for Slack notification
const lambdaSlackAlarmRole = new aws.iam.Role("lambda-slack-alarm-role", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
}, { provider });

// Attach multiple policies to the Lambda role
[
    "arn:aws:iam::aws:policy/AWSLambdaExecute",
    "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess",
    "arn:aws:iam::aws:policy/AmazonCloudWatchEvidentlyFullAccess"
].forEach(policyArn => {
    new aws.iam.RolePolicyAttachment(`${policyArn.split('/').pop()}Attachment`, {
        role: lambdaSlackAlarmRole.name,
        policyArn: policyArn,
    }, { provider });
});

// Lambda function code (Python 3.12 runtime)
const lambdaSlackNotification = new aws.lambda.Function("slack-alarm-notification", {
    runtime: "python3.12",
    role: lambdaSlackAlarmRole.arn,
    handler: "lambda_function.lambda_handler",  // Placeholder handler that matches the Lambda code's entry point
    environment: {
        variables: {
            SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/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",
        },
    },
    code: new pulumi.asset.FileArchive("myDeploymentPackage.zip"),  // Point to your zip file
}, { provider });


// Subscribe the Lambda to the existing SNS topic
const lambdaSnsSubscription = new aws.sns.TopicSubscription("lambdaSnsSubscription", {
    topic: snsTopic.arn,
    protocol: "lambda",
    endpoint: lambdaSlackNotification.arn,
}, { provider });

// Grant SNS permission to invoke the Lambda function
const snsPermission = new aws.lambda.Permission("snsPermission", {
    action: "lambda:InvokeFunction",
    function: lambdaSlackNotification.name,
    principal: "sns.amazonaws.com",
    sourceArn: snsTopic.arn,
}, { provider });
