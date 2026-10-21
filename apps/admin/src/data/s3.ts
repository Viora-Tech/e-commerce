/** Copy for the Amazon S3 app (Apps → Amazon S3). */

/** IAM policy JSON, scoped to exactly one bucket. `bucket` is trimmed and never empty when shown. */
export function s3IamPolicy(bucket: string): string {
  const b = bucket.trim() || 'YOUR-BUCKET-NAME'
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'StoreFilesObjectAccess',
          Effect: 'Allow',
          Action: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
          Resource: `arn:aws:s3:::${b}/*`,
        },
        {
          Sid: 'StoreFilesBucketList',
          Effect: 'Allow',
          Action: ['s3:ListBucket'],
          Resource: `arn:aws:s3:::${b}`,
        },
      ],
    },
    null,
    2,
  )
}

/** CORS rule allowing a browser to PUT straight to the bucket from the admin origin. */
export function s3CorsRule(adminOrigin: string): string {
  const origin = adminOrigin.trim() || 'https://your-admin-domain.example.com'
  return JSON.stringify(
    [
      {
        AllowedOrigins: [origin],
        AllowedMethods: ['PUT', 'GET', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000,
      },
    ],
    null,
    2,
  )
}

export const s3AppContent = {
  connect: {
    title: 'Connect Amazon S3',
    intro:
      'Store product images and files in your own Amazon S3 bucket, uploaded straight from the browser to S3.',
    consoleUrl: 'https://console.aws.amazon.com/s3/',
    iamUrl: 'https://console.aws.amazon.com/iamv2/home#/users/create',
    openConsole: 'Open the S3 console',
    openIam: 'Open the IAM console',
    steps: {
      one: {
        title: 'Create a bucket',
        body: 'In the S3 console, create a bucket in the region you want to serve from. Keep "Block all public access" turned on — objects are read through a public URL or CloudFront, not by making the bucket itself public.',
      },
      two: {
        title: 'Create an IAM user with a minimal policy',
        body: 'Create an IAM user for this app with programmatic access only (no console password), then attach this inline policy so it can only touch this one bucket:',
      },
      three: {
        title: 'Paste the keys',
        body: 'Create an access key for that user and paste both values below. The secret is shown once by AWS — copy it immediately.',
      },
      four: {
        title: 'Test the connection',
        body: 'Press "Test connection". It writes a tiny test file to the bucket, confirms it can read it back, then deletes it — proving the policy actually works before you save.',
      },
    },
    publicAccess: {
      heading: 'Public access vs CloudFront',
      body: 'Public URL: the bucket serves files directly over plain HTTPS at its own S3 address. Simplest to set up, no extra cost, fine for most stores. CloudFront: a CDN sits in front of the bucket, caching files closer to shoppers worldwide and hiding the bucket\'s real address. Faster for a store with visitors far from the bucket\'s region, but one more thing to set up and a small extra cost. Start with the public URL; add CloudFront later by pointing a distribution at the bucket and pasting its domain into "Public URL / CloudFront domain" below — nothing else changes.',
    },
    cors: {
      heading: 'CORS rule for browser uploads',
      body: "Uploads go straight from the browser to S3 with a presigned URL, so the bucket needs a CORS rule allowing PUT (and GET/HEAD, for the connection test) from this admin's origin. In the S3 console: bucket → Permissions → Cross-origin resource sharing (CORS) → paste this, replacing the origin if this admin is served from a different domain:",
    },
    fields: {
      accessKeyId: { label: 'Access key ID' },
      secretAccessKey: {
        label: 'Secret access key',
        help: 'Shown once when the access key is created. If lost, create a new access key rather than trying to recover it.',
      },
      region: { label: 'Region', help: 'e.g. ap-south-1, us-east-1 — must match the bucket.' },
      bucket: { label: 'Bucket' },
      publicBaseUrl: {
        label: 'Public URL / CloudFront domain',
        help: "Leave blank to use the bucket's own S3 URL.",
      },
      pathPrefix: {
        label: 'Path prefix (optional)',
        help: 'A folder inside the bucket, so this store never collides with anything else already there.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'Writes, reads back and deletes one tiny file. Nothing else in the bucket is touched.',
    save: 'Save and connect',
    discard: 'Discard',
    nextImage: {
      heading: 'Product images in next/image',
      body: "The storefront and admin load images through next/image, which only fetches from hosts it is told to trust. The public URL (or CloudFront domain) above must be listed in both apps' next.config.ts under images.remotePatterns — already wired for S3_PUBLIC_BASE_URL when it is set at build time; a custom CloudFront domain typed here after that needs the same env var set before the next build. See docs/developer-docs/building for the exact lines.",
    },
  },
} as const
