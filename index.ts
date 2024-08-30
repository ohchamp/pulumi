import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";

// Reference the existing S3 bucket
const existingBucketName = "cloudtrailbukcherorganas";

// CloudWatch Logs group to store CloudTrail logs
const cloudTrailLogGroup = new aws.cloudwatch.LogGroup("cloudTrailLogGroup", {
    retentionInDays: 90, // Customize log retention if needed
});

// SNS Topic for sending notifications
const snsTopic = new aws.sns.Topic("cloudTrailAlarmTopic");

// Create the CloudTrail
const cloudTrail = new aws.cloudtrail.Trail("organizationTrail", {
    isOrganizationTrail: true,
    s3BucketName: existingBucketName, // Use the existing bucket
    cloudWatchLogsGroupArn: cloudTrailLogGroup.arn,
    cloudWatchLogsRoleArn: new aws.iam.Role("cloudTrailCWLogsRole", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "cloudtrail.amazonaws.com" }),
    }).arn,
    includeGlobalServiceEvents: true,
    isMultiRegionTrail: true,
});

// IAM Role for CloudTrail to publish logs to CloudWatch
const cloudTrailLogRole = new aws.iam.RolePolicyAttachment("cloudTrailLogPolicyAttachment", {
    role: cloudTrail.cloudWatchLogsRoleArn,
    policyArn: aws.iam.ManagedPolicy.CloudWatchLogsFullAccess,
});

// Metric Filter for detecting root usage
const rootMetricFilter = new aws.cloudwatch.MetricFilter("rootMetricFilter", {
    logGroupName: cloudTrailLogGroup.name,
    filterPattern: "{ $.userIdentity.type = \"Root\" }",
    metricTransformations: [{
        name: "RootUsage",
        namespace: "CloudTrailMetrics",
        value: "1",
    }],
});

// CloudWatch Alarm for triggering when root activity is detected
const rootUsageAlarm = new aws.cloudwatch.MetricAlarm("rootUsageAlarm", {
    alarmName: "RootActivityAlarm",
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    evaluationPeriods: 1,
    metricName: rootMetricFilter.metricTransformations[0].name,
    namespace: rootMetricFilter.metricTransformations[0].namespace,
    period: 300, // Period in seconds
    statistic: "Sum",
    threshold: 1,
    alarmActions: [snsTopic.arn],
    alarmDescription: "Alarm when root activity is detected.",
});

// Allow CloudTrail to write to CloudWatch Logs
const cloudTrailLogRolePolicy = new aws.iam.RolePolicy("cloudTrailLogRolePolicy", {
    role: cloudTrail.cloudWatchLogsRoleArn,
    policy: pulumi.interpolate`{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                "Resource": "${cloudTrailLogGroup.arn}:*"
            }
        ]
    }`,
});

// Subscription to SNS topic (modify with your email or other endpoint)
const snsSubscription = new aws.sns.TopicSubscription("snsSubscription", {
    topic: snsTopic.arn,
    protocol: "email", // You can also use "sms", "lambda", etc.
    endpoint: "anascloudaws@gmail.com", // Replace with actual email
});
