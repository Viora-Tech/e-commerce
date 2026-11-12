# Photo processing encodes one width at a time (#1547)

- `processImage` (`packages/core/src/media/pipeline.ts`) now encodes variant widths one after
  another for every profile, not only `bulk`. A merchant's own upload used to encode every width
  at once.
- Why: the Rust image-worker pilot (draft PR #1542) measured 400–500 MB peak for a 12–24 MP photo
  with all widths at once, above the worker's 384 MB limit, using 1.6–2.4 cores. The worker runs
  on one core (#1471), so the parallel encode bought no speed there. One width at a time measured
  136–240 MB for the same photos.
- Output is unchanged: same widths, formats, quality and keys. `pipeline.test.ts` passes (15).
- Check after deploy: the worker's memory during a photo upload stays under its limit.
