import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Define account numbers
const AccountNumbers = {
    root:  "039612852088", // Replace with your root account number
    orgid: "o-m4vdlthei3", // Replace with your organization ID account number
};

// Create S3 bucket
const cloudTrailBucket = new aws.s3.Bucket("cloudtrailBucket", {
    bucket: "lykke-b2c-logging-logs-trail-test",
});

// Define bucket policy document
const bucketPolicyDocument = {
    Version: "2012-10-17",
    Statement: [
        {
            Sid: "AWSCloudTrailAclCheck",
            Effect: "Allow",
            Principal: {
                Service: "cloudtrail.amazonaws.com",
            },
            Action: "s3:GetBucketAcl",
            Resource: cloudTrailBucket.arn,
        },
        {
            Sid: "AWSCloudTrailWrite20150319",
            Effect: "Allow",
            Principal: {
                Service: "cloudtrail.amazonaws.com",
            },
            Action: "s3:PutObject",
            Resource: pulumi.interpolate`${cloudTrailBucket.arn}/AWSLogs/${AccountNumbers.root}/*`,
            Condition: {
                StringEquals: {
                    "s3:x-amz-acl": "bucket-owner-full-control",
                },
            },
        },
        {
            Sid: "AWSCloudTrailWrite",
            Effect: "Allow",
            Principal: {
                Service: "cloudtrail.amazonaws.com",
            },
            Action: "s3:PutObject",
            Resource: pulumi.interpolate`${cloudTrailBucket.arn}/AWSLogs/${AccountNumbers.orgid}/*`,
            Condition: {
                StringEquals: {
                    "s3:x-amz-acl": "bucket-owner-full-control",
                },
            },
        },
    ],
};

// Associate policy to S3 bucket
const cloudTrailBucketPolicy = new aws.s3.BucketPolicy("cloudTrailBucketPolicy", {
    bucket: cloudTrailBucket.bucket,
    policy: JSON.stringify(bucketPolicyDocument),
});
