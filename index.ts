import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Define account numbers
const AccountNumbers = {
    root: "039612852088", // Replace with your root account number
    orgid: "o-m4vdlthei3", // Replace with your organization ID account number
};

// Create S3 bucket
const cloudTrailBucket = new aws.s3.Bucket("cloudtrailBucket", {
    bucket: "lykke-b2c-logging-logs-trail-test",
});

// Create the bucket policy dynamically applying the bucket name
const cloudTrailBucketPolicy = new aws.s3.BucketPolicy("cloudTrailBucketPolicy", {
    bucket: cloudTrailBucket.bucket,
    policy: cloudTrailBucket.bucket.apply(bucketName => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "AWSCloudTrailAclCheck",
                Effect: "Allow",
                Principal: {
                    Service: "cloudtrail.amazonaws.com",
                },
                Action: "s3:GetBucketAcl",
                Resource: `arn:aws:s3:::${cloudTrailBucket.bucket}`,
            },
            {
                Sid: "AWSCloudTrailWrite20150319",
                Effect: "Allow",
                Principal: {
                    Service: "cloudtrail.amazonaws.com",
                },
                Action: "s3:PutObject",
                Resource: `arn:aws:s3:::${cloudTrailBucket.bucket}/AWSLogs/${AccountNumbers.root}/*`,
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
                Resource: `arn:aws:s3:::${cloudTrailBucket.bucket}/AWSLogs/${AccountNumbers.orgid}/*`,
                Condition: {
                    StringEquals: {
                        "s3:x-amz-acl": "bucket-owner-full-control",
                    },
                },
            },
        ],
    })),
});