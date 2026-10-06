import { appSettingsOf, parseAppsSettings, withAppSettings } from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import {
  parseReviewsSettings,
  REVIEWS_ID,
  type ReviewsSettings,
  ReviewsSettingsSchema,
} from './settings'

/** Whether the store installed the Reviews app, and its settings (defaults when never saved). */
export async function reviewsState(
  tx: StoreTx,
  storeId: string,
): Promise<{ installed: boolean; settings: ReviewsSettings }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return {
    installed: apps.installed.includes(REVIEWS_ID),
    settings: parseReviewsSettings(appSettingsOf(apps, REVIEWS_ID)),
  }
}

export async function loadReviewsSettings(tx: StoreTx, storeId: string): Promise<ReviewsSettings> {
  return (await reviewsState(tx, storeId)).settings
}

/** Saves the whole settings object in `store.apps`; the install list and other apps are untouched. */
export async function saveReviewsSettings(
  tx: StoreTx,
  storeId: string,
  input: ReviewsSettings,
): Promise<ReviewsSettings> {
  const next = ReviewsSettingsSchema.parse(input)
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = withAppSettings(parseAppsSettings(s?.apps), REVIEWS_ID, next)
  await tx.update(store).set({ apps }).where(eq(store.id, storeId))
  return next
}
