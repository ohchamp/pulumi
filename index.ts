import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";

const organizationId = "o-m4vdlthei3"; // Replace with your actual AWS Organization ID
const accountid = "039612852088"; // Replace with your actual AWS Account ID

// Reference the existing S3 bucket
const existingBucketName = "cloudtrailbukcherorganas";

// Create the IAM Role for CloudTrail to write to CloudWatch Logs
const cloudTrailCWLogsRole = new aws.iam.Role("cloudTrailCWLogsRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "cloudtrail.amazonaws.com" }),
});

// IAM Role attachment for CloudTrail to publish logs to CloudWatch
const cloudTrailLogRoleAttachment = new aws.iam.RolePolicyAttachment("cloudTrailLogPolicyAttachment", {
    role: cloudTrailCWLogsRole.name, // Use role name, not ARN
    policyArn: aws.iam.ManagedPolicy.CloudWatchLogsFullAccess,
});

// CloudWatch Logs group to store CloudTrail logs
const cloudTrailLogGroup = new aws.cloudwatch.LogGroup("cloudTrailLogGroup", {
    retentionInDays: 90, // Customize log retention if needed
});

// Create the CloudTrail
const cloudTrail = new aws.cloudtrail.Trail("organizationTrail", {
    isOrganizationTrail: true,
    s3BucketName: existingBucketName, // Assuming you already have the bucket
    cloudWatchLogsGroupArn: cloudTrailLogGroup.arn,
    cloudWatchLogsRoleArn: cloudTrailCWLogsRole.arn, // Referencing the role's ARN
    includeGlobalServiceEvents: true,
    isMultiRegionTrail: true,
});

// Metric Filter for detecting root usage
const rootMetricFilter = new aws.cloudwatch.LogMetricFilter("rootMetricFilter", {
    logGroupName: cloudTrailLogGroup.name,
    pattern: "{ $.userIdentity.type = \"Root\" }",  // Correct pattern property
    metricTransformation: {  // Use singular 'metricTransformation'
        name: "RootUsage",
        namespace: "CloudTrailMetrics",
        value: "1",
    },
});

// SNS Topic for sending notifications
const snsTopic = new aws.sns.Topic("cloudTrailAlarmTopic");

// Subscription to SNS topic (modify with your email or other endpoint)
const snsSubscription = new aws.sns.TopicSubscription("snsSubscription", {
    topic: snsTopic.arn,
    protocol: "email", // You can also use "sms", "lambda", etc.
    endpoint: "anascloudaws@gmail.com", // Replace with actual email
});


// CloudWatch Alarm for triggering when root activity is detected
const rootUsageAlarm = new aws.cloudwatch.MetricAlarm("rootUsageAlarm", {
    name: "RootActivityAlarm",  // Use 'alarmName' instead of 'name'
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    evaluationPeriods: 1,
    metricName: rootMetricFilter.metricTransformation.name,  // Use singular 'metricTransformation'
    namespace: rootMetricFilter.metricTransformation.namespace,  // Access the singular 'metricTransformation'
    period: 300, // Period in seconds
    statistic: "Sum",
    threshold: 1,
    alarmActions: [snsTopic.arn],
    alarmDescription: "Alarm when root activity is detected.",
});


// Allow CloudTrail to write to CloudWatch Logs
const cloudTrailLogRolePolicy = new aws.iam.RolePolicy("cloudTrailLogRolePolicy", {
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
                    "arn:aws:logs:eu-west-1:039612852088:log-group:${cloudTrailLogGroup.name}:log-stream:${organizationId}_*",
                    "arn:aws:logs:eu-west-1:039612852088:log-group:${cloudTrailLogGroup.name}:log-stream::log-stream:039612852088_CloudTrail_eu-west-1*"
                ]
            },
            {
                "Sid": "AWSCloudTrailPutLogEvents",
                "Effect": "Allow",
                "Action": [
                    "logs:PutLogEvents"
                ],
                "Resource": [
                    "arn:aws:logs:eu-west-1:${accountid}:log-group:${cloudTrailLogGroup.name}:log-stream:${organizationId}_*",
                    "arn:aws:logs:eu-west-1:${accountid}:log-group:${cloudTrailLogGroup.name}:log-stream::log-stream:039612852088_CloudTrail_eu-west-1*"
                ]
            }
        ]
    }`,
});