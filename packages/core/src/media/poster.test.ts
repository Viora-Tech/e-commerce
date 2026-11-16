/** SOURCE OF TRUTH: tests for video posters — WHAT a video links to its poster picture and Customize finds it by the video address; a non-picture poster or a non-video is refused / WHY a hero video must never show its black first frame */
import { createDb, media, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setVideoPoster, videoPosterByUrl } from './poster'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'p', name: 'P' }).returning()
  const storeId = s?.id as string
  const file = (name: string, contentType: string) => ({
    storeId,
    url: `https://cdn.example/${name}`,
    key: name,
    contentType,
    size: 10,
    status: 'ready' as const,
  })
  const [video, poster, other] = await owner
    .insert(media)
    .values([
      file('hero.mp4', 'video/mp4'),
      { ...file('hero-poster.jpg', 'image/jpeg'), width: 1920, height: 1080 },
      file('menu.pdf', 'application/pdf'),
    ])
    .returning()
  return {
    storeId,
    video: video?.id as string,
    poster: poster?.id as string,
    other: other?.id as string,
  }
}

describe('video posters', () => {
  it('links a poster to a video and finds it by the video address', async () => {
    const { storeId, video, poster } = await seed()
    await withStore(app, storeId, (tx) => setVideoPoster(tx, video, poster))
    const found = await withStore(app, storeId, (tx) =>
      videoPosterByUrl(tx, 'https://cdn.example/hero.mp4'),
    )
    expect(found).toEqual({ url: 'https://cdn.example/hero-poster.jpg', width: 1920, height: 1080 })
    expect(
      await withStore(app, storeId, (tx) => videoPosterByUrl(tx, 'https://elsewhere/x.mp4')),
    ).toBeNull()
  })

  it('refuses a poster that is not a picture, or a "video" that is not one', async () => {
    const { storeId, video, poster, other } = await seed()
    await expect(withStore(app, storeId, (tx) => setVideoPoster(tx, video, other))).rejects.toThrow(
      'A poster must be a picture',
    )
    await expect(
      withStore(app, storeId, (tx) => setVideoPoster(tx, poster, poster)),
    ).rejects.toThrow('Only a video can have a poster')
  })
})
