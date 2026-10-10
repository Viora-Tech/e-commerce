import type { ArticleLoader } from '../../blog-posts-block'
import type { ProductLoader } from '../../puck-config'
import type { CollectionLoader, SingleProductLoader } from '../library'

/**
 * What a Zero Drift theme section may load (products, one product, collections, blog posts).
 * The same loaders `createBlocksConfig` already receives from the storefront and the
 * admin editor; a section reads them in its `resolveData`, never fetches on its own.
 */
export type ZeroDriftLoaders = {
  loadProducts: ProductLoader
  loadCollections?: CollectionLoader | undefined
  loadProduct?: SingleProductLoader | undefined
  loadArticles?: ArticleLoader | undefined
}
