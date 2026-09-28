import { PutObjectCommand } from '@aws-sdk/client-s3'
import { describe, expect, it } from 'vitest'
import { defaultSign, makeS3CompatClient } from '../src/client'

describe('defaultSign', () => {
  it('signs the content type, so a PUT cannot swap image/png for text/html', async () => {
    // Signing is local maths: no request leaves the process.
    const client = makeS3CompatClient({
      region: 'auto',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'test-only-secret',
      endpoint: 'https://example.test',
      forcePathStyle: true,
    })
    const url = await defaultSign(
      client,
      new PutObjectCommand({
        Bucket: 'b',
        Key: 'k.png',
        ContentType: 'image/png',
        ContentLength: 10,
      }),
      60,
    )
    const signed = new URL(url).searchParams.get('X-Amz-SignedHeaders')?.split(';') ?? []
    expect(signed).toEqual(expect.arrayContaining(['content-type', 'content-length', 'host']))
  })
})
