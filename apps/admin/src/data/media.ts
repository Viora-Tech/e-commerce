/** Copy for uploads, the product media card and the files library. */
export const mediaContent = {
  accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4',
  dropzone: {
    idle: 'Drop images or videos here, or click to choose',
    active: 'Release to upload',
    hint: 'JPG, PNG, WebP, GIF, AVIF or MP4. Up to 25 MB each.',
    button: 'Add files',
  },
  tile: {
    cover: 'Cover',
    uploading: (pct: number) => `${pct}%`,
    failed: 'Upload failed',
    retry: 'Retry',
    menu: 'More',
    setCover: 'Set as cover',
    moveLeft: 'Move earlier',
    moveRight: 'Move later',
    editAlt: 'Edit alt text',
    remove: 'Remove from product',
    delete: 'Delete file',
    video: 'Video',
  },
  altDialog: {
    title: 'Alt text',
    body: 'Describes the image for screen readers and search engines. Keep it short and specific.',
    label: 'Alt text',
    placeholder: 'Black glass mousepad, top view',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Alt text saved',
  },
  errors: {
    type: (name: string) => `${name} is not an image or MP4 video.`,
    size: (name: string) => `${name} is over 25 MB.`,
    upload: (name: string) => `Could not upload ${name}. Check the storage settings and try again.`,
    generic: 'Something went wrong with the upload.',
  },
  toasts: {
    uploaded: (n: number) => (n === 1 ? '1 file uploaded' : `${n} files uploaded`),
    deleted: 'File deleted',
  },
  library: {
    title: 'Files',
    intro: 'Everything uploaded to this store. Files stay here when removed from a product.',
    search: 'Search by alt text or file name',
    upload: 'Upload',
    empty: {
      heading: 'No files yet',
      body: 'Upload product images here or from any product page. They are stored on the provider chosen under Settings, Files.',
      action: 'Upload files',
    },
    used: (n: number) =>
      n === 0 ? 'Not used' : n === 1 ? 'Used on 1 product' : `Used on ${n} products`,
    deleteTitle: 'Delete this file?',
    deleteBody: (n: number) =>
      n > 0
        ? `It is used on ${n} ${n === 1 ? 'product' : 'products'}. Those galleries lose it immediately.`
        : 'The file is removed from storage. This cannot be undone.',
    deleteConfirm: 'Delete',
    cancel: 'Cancel',
    pagination: (from: number, to: number, total: number) => `${from}-${to} of ${total}`,
    previous: 'Previous',
    next: 'Next',
  },
  picker: {
    title: 'Select file',
    search: 'Search files',
    addMedia: 'Add media',
    uploadFiles: 'Upload files',
    fromUrl: 'From URL',
    fromUrlPlaceholder: 'https://example.com/image.jpg',
    fromUrlAdd: 'Add',
    fromUrlBusy: 'Adding…',
    fromUrlFailed: 'Could not add that URL. It may block cross-site requests.',
    dropHint: 'Drag and drop images, videos and files',
    sort: {
      label: 'Sort',
      newest: 'Newest',
      oldest: 'Oldest',
      name: 'Name (A-Z)',
      size: 'File size',
    },
    view: { grid: 'Grid view', list: 'List view' },
    filters: {
      fileType: { label: 'File type', all: 'All types', image: 'Images', video: 'Videos' },
      size: {
        label: 'File size',
        all: 'Any size',
        small: 'Under 200 KB',
        medium: '200 KB - 2 MB',
        large: 'Over 2 MB',
      },
      used: { label: 'Used in', all: 'Any', used: 'Used on a product', unused: 'Not used' },
    },
    loading: 'Loading files…',
    empty: 'Nothing uploaded yet',
    noResults: 'No files match your filters',
    cancel: 'Cancel',
    done: 'Done',
    selectedCount: (n: number) => (n === 1 ? '1 selected' : `${n} selected`),
  },
  settings: {
    title: 'Files',
    intro:
      'Where uploads are stored. The first enabled provider receives new files; the local folder is used when nothing is enabled and only works on a development machine.',
    hints: {
      local:
        'Writes to public/uploads on this machine and is served by the admin app. Fine for development; production needs a bucket.',
      r2: 'Create an R2 bucket, give it a public URL (r2.dev subdomain or custom domain), add a CORS rule allowing PUT from this admin origin, then paste an API token with Object Read & Write.',
    } as Record<string, string>,
    verifyHeading: 'Connection',
    verifyHelp:
      'Checks the saved provider can see its bucket. Save first if you changed anything above.',
    verify: 'Test connection',
    verifying: 'Testing',
  },
} as const
