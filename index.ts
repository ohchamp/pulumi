import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Create an S3 bucket
const pulumiStateBucket = new aws.s3.Bucket("pulumi-state-bucket", {
    bucket: "my-pulumi-state-bucket-test-5",  // Ensure this is unique
    versioning: {
        enabled: true,
    },
    serverSideEncryptionConfiguration: {
        rule: {
            applyServerSideEncryptionByDefault: {
                sseAlgorithm: "AES256",  // Server-side encryption
            },
        },
    },
});

// Export the bucket name
export const bucketName = pulumiStateBucket.bucket;