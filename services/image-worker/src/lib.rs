//! Upload-time image pipeline, Rust pilot (roadmap pilot G).
//!
//! A port of `packages/core/src/media/pipeline.ts` (`processImage`). Same inputs, same outputs:
//!
//! - **Master**: auto-oriented from EXIF, all metadata stripped (we never write any), long edge
//!   capped at [`MAX_MASTER_LONG_EDGE`]. `image/jpeg` uploads stay JPEG (mozjpeg, quality 90);
//!   everything else becomes PNG (zlib level 9, no filter, like sharp's `compressionLevel: 9`).
//! - **Variants**: AVIF (quality 55) and WebP (quality 72, method 4) at every width in
//!   [`VARIANT_WIDTHS`] that does not upscale, plus the master's own width
//!   ([`variant_widths_for`]). Named by [`variant_key`] (`name-w640.avif`).
//! - **ThumbHash** of the master shrunk to fit 100 x 100, base64.
//! - **Animated GIF**: one animated WebP master (quality 72, method 4), no variants.
//! - **Bomb guard**: more than [`LIMIT_INPUT_PIXELS`] pixels in the header is refused before any
//!   pixel is decoded.
//!
//! Differences from the TypeScript pipeline, on purpose or not yet done:
//!
//! - Variants are resized from the master's pixels in memory, not from a re-decode of the
//!   JPEG-90 master bytes (one decode fewer, slightly sharper copies).
//! - The source is shrunk *before* the EXIF rotation, so the rotation only touches master-sized
//!   pixels (less memory, same result).
//! - Everything runs on one thread (`ravif` and `rav1e` are built without threading).
//! - AVIF uses rav1e through `ravif`, 4:4:4 chroma, 8-bit; sharp uses libaom, 4:2:0, 8-bit.
//!   Effort maps to rav1e speed `10 - effort` (interactive 4 -> 6, bulk 2 -> 8).
//! - HEIC and AVIF **inputs** are not decoded yet (needs libheif/dav1d); they return
//!   [`PipelineError::Unsupported`]. Embedded ICC profiles are dropped, not converted to sRGB.

use std::io::Cursor;

use base64::Engine as _;
use fast_image_resize as fr;
use image::{AnimationDecoder, DynamicImage, ImageDecoder, ImageFormat, ImageReader};

/// Never generate a master bigger than this on the long edge (`constants.ts`).
pub const MAX_MASTER_LONG_EDGE: u32 = 2560;
/// Responsive widths (`constants.ts`); widths above the master are skipped.
pub const VARIANT_WIDTHS: [u32; 4] = [320, 640, 1280, 1920];
/// Decompression-bomb guard, same as `LIMIT_INPUT_PIXELS` in `pipeline.ts`.
pub const LIMIT_INPUT_PIXELS: u64 = 40_000_000;
const THUMBHASH_MAX_DIMENSION: u32 = 100;

/// `'interactive'` (a merchant's own upload) or `'bulk'` (imports, backlogs): only AVIF effort differs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Profile {
    Interactive,
    Bulk,
}

impl Profile {
    /// `AVIF_EFFORT` in `pipeline.ts`.
    pub fn avif_effort(self) -> u8 {
        match self {
            Profile::Interactive => 4,
            Profile::Bulk => 2,
        }
    }
}

/// Encoder settings; [`Options::new`] gives the same defaults as `processImage`.
#[derive(Debug, Clone)]
pub struct Options {
    pub content_type: String,
    pub master_key: String,
    pub profile: Profile,
    pub avif_quality: f32,
    pub webp_quality: f32,
    /// 0-9, lower is faster (sharp's scale). `None` = the profile's effort.
    pub avif_effort: Option<u8>,
    /// libwebp `method`, 0-6.
    pub webp_effort: i32,
    pub max_input_pixels: u64,
    /// Override the rav1e speed (1-10) directly; `None` maps from effort.
    pub avif_speed: Option<u8>,
}

impl Options {
    pub fn new(content_type: &str, master_key: &str) -> Self {
        Options {
            content_type: content_type.to_ascii_lowercase(),
            master_key: master_key.to_string(),
            profile: Profile::Interactive,
            avif_quality: 55.0,
            webp_quality: 72.0,
            avif_effort: None,
            webp_effort: 4,
            max_input_pixels: LIMIT_INPUT_PIXELS,
            avif_speed: None,
        }
    }

    fn rav1e_speed(&self) -> u8 {
        if let Some(speed) = self.avif_speed {
            return speed.clamp(1, 10);
        }
        let effort = self.avif_effort.unwrap_or(self.profile.avif_effort()).min(9);
        10 - effort
    }
}

/// One file to write: same shape as `ProcessedAsset` (cache-control is the caller's business).
#[derive(Debug, Clone)]
pub struct Asset {
    pub content_type: &'static str,
    pub key: String,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct Variant {
    pub width: u32,
    pub height: u32,
    pub avif: Asset,
    pub webp: Asset,
}

/// Same shape as `ProcessImageResult`.
#[derive(Debug, Clone)]
pub struct Processed {
    pub master: Asset,
    pub variants: Vec<Variant>,
    pub width: u32,
    pub height: u32,
    pub thumbhash: String,
    pub animated: bool,
}

#[derive(Debug)]
pub enum PipelineError {
    /// `DecompressionBombError` in TypeScript: the worker marks the row failed with `rejected: ...`.
    DecompressionBomb { width: u32, height: u32, limit: u64 },
    /// Not one of the raster formats uploads accept, or one this pilot cannot decode yet.
    Unsupported(String),
    Decode(String),
    Encode(String),
}

impl std::fmt::Display for PipelineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PipelineError::DecompressionBomb { width, height, limit } => write!(
                f,
                "image exceeds the decompression-bomb pixel limit ({width}x{height} > {limit} pixels)"
            ),
            PipelineError::Unsupported(m) => write!(f, "not a supported image format: {m}"),
            PipelineError::Decode(m) => write!(f, "could not decode image: {m}"),
            PipelineError::Encode(m) => write!(f, "could not encode image: {m}"),
        }
    }
}

impl std::error::Error for PipelineError {}

fn decode_err(e: impl std::fmt::Display) -> PipelineError {
    PipelineError::Decode(e.to_string())
}

/// `stores/x/media/id-name.jpg` + 640 + `avif` -> `stores/x/media/id-name-w640.avif` (`constants.ts`).
pub fn variant_key(master_key: &str, width: u32, format: &str) -> String {
    let base = match master_key.rfind('.') {
        Some(dot) => &master_key[..dot],
        None => master_key,
    };
    format!("{base}-w{width}.{format}")
}

/// Every standard width the master can fill, plus the master's own width (`variantWidthsFor`).
pub fn variant_widths_for(master_width: u32) -> Vec<u32> {
    let mut widths: Vec<u32> = VARIANT_WIDTHS.iter().copied().filter(|w| *w <= master_width).collect();
    if master_width > 0 && !widths.contains(&master_width) {
        widths.push(master_width);
    }
    widths
}

/// Master size for an upright `w x h` source: long edge capped, rounded like `Math.round`.
pub fn master_size(w: u32, h: u32) -> (u32, u32) {
    let long_edge = w.max(h);
    if long_edge <= MAX_MASTER_LONG_EDGE {
        return (w, h);
    }
    let scale = MAX_MASTER_LONG_EDGE as f64 / long_edge as f64;
    (round_half_up(w as f64 * scale).max(1), round_half_up(h as f64 * scale).max(1))
}

/// `sharp.resize({ width: min(w,100), height: min(h,100), fit: 'inside' })`.
pub fn thumbhash_size(w: u32, h: u32) -> (u32, u32) {
    let bw = w.min(THUMBHASH_MAX_DIMENSION) as f64;
    let bh = h.min(THUMBHASH_MAX_DIMENSION) as f64;
    let scale = (bw / w as f64).min(bh / h as f64);
    (round_half_up(w as f64 * scale).max(1), round_half_up(h as f64 * scale).max(1))
}

/// JavaScript `Math.round` for non-negative numbers.
fn round_half_up(x: f64) -> u32 {
    (x + 0.5).floor() as u32
}

/// The bytes' real format; only the raster formats uploads accept are let through.
fn sniff(bytes: &[u8]) -> Result<ImageFormat, PipelineError> {
    let format = image::guess_format(bytes).map_err(|_| PipelineError::Unsupported("unknown".into()))?;
    match format {
        ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::WebP | ImageFormat::Gif => Ok(format),
        ImageFormat::Avif => Err(PipelineError::Unsupported("avif input (not in the pilot yet)".into())),
        other => Err(PipelineError::Unsupported(format!("{other:?}").to_lowercase())),
    }
}

/// HEIC has no magic `image` knows; recognise the ISO-BMFF `ftyp` brands so the error is clear.
fn is_heif(bytes: &[u8]) -> bool {
    bytes.len() >= 12
        && &bytes[4..8] == b"ftyp"
        && matches!(&bytes[8..12], b"heic" | b"heix" | b"hevc" | b"heim" | b"heis" | b"mif1" | b"msf1")
}

fn check_bomb(width: u32, height: u32, limit: u64) -> Result<(), PipelineError> {
    if width as u64 * height as u64 > limit {
        return Err(PipelineError::DecompressionBomb { width, height, limit });
    }
    Ok(())
}

/// The whole pipeline for one upload: bytes in, every file to write out.
pub fn process_image(bytes: &[u8], opts: &Options) -> Result<Processed, PipelineError> {
    if is_heif(bytes) {
        return Err(PipelineError::Unsupported("heif input (not in the pilot yet)".into()));
    }
    let format = sniff(bytes)?;

    if opts.content_type == "image/gif" && format == ImageFormat::Gif {
        if let Some(result) = process_animated_gif(bytes, opts)? {
            return Ok(result);
        }
    }

    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    reader.no_limits(); // the pixel cap below is the guard; `image`'s own default (512 MB) would be looser
    let mut decoder = reader.into_decoder().map_err(decode_err)?;
    let (raw_w, raw_h) = decoder.dimensions();
    check_bomb(raw_w, raw_h, opts.max_input_pixels)?;
    if raw_w == 0 || raw_h == 0 {
        return Err(PipelineError::Decode("could not read image dimensions".into()));
    }
    let orientation = decoder.orientation().unwrap_or(image::metadata::Orientation::NoTransforms);
    let quarter_turn = matches!(
        orientation,
        image::metadata::Orientation::Rotate90
            | image::metadata::Orientation::Rotate270
            | image::metadata::Orientation::Rotate90FlipH
            | image::metadata::Orientation::Rotate270FlipH
    );
    let (src_w, src_h) = if quarter_turn { (raw_h, raw_w) } else { (raw_w, raw_h) };
    let (master_w, master_h) = master_size(src_w, src_h);

    let decoded = DynamicImage::from_decoder(decoder).map_err(decode_err)?;
    let has_alpha = decoded.color().has_alpha();
    let is_jpeg = opts.content_type == "image/jpeg";
    // A JPEG master cannot hold alpha; sharp flattens it the same way (drops it, onto black).
    let keep_alpha = has_alpha && !is_jpeg;
    let channels: usize = if keep_alpha { 4 } else { 3 };

    // Shrink in the source's own orientation, then rotate: the rotation only touches master pixels.
    let (pre_w, pre_h) = if quarter_turn { (master_h, master_w) } else { (master_w, master_h) };
    let src = to_fr_image(decoded, keep_alpha);
    let shrunk = resize(&src, pre_w, pre_h)?;
    drop(src);
    let mut upright = from_fr_image(shrunk, keep_alpha);
    upright.apply_orientation(orientation);
    let master_pixels = to_fr_image(upright, keep_alpha);
    debug_assert_eq!((master_pixels.width(), master_pixels.height()), (master_w, master_h));

    let (master_body, master_type) = if is_jpeg {
        (encode_jpeg(master_pixels.buffer(), master_w, master_h, 90.0)?, "image/jpeg")
    } else {
        (encode_png(master_pixels.buffer(), master_w, master_h, keep_alpha)?, "image/png")
    };

    let mut variants = Vec::new();
    for width in variant_widths_for(master_w) {
        let height = round_half_up(width as f64 / master_w as f64 * master_h as f64).max(1);
        let copy;
        let pixels = if width == master_w && height == master_h {
            master_pixels.buffer()
        } else {
            copy = resize(&master_pixels, width, height)?;
            copy.buffer()
        };
        let avif = encode_avif(pixels, width, height, keep_alpha, opts)?;
        let webp = encode_webp(pixels, width, height, keep_alpha, opts.webp_quality, opts.webp_effort)?;
        variants.push(Variant {
            width,
            height,
            avif: Asset { content_type: "image/avif", key: variant_key(&opts.master_key, width, "avif"), body: avif },
            webp: Asset { content_type: "image/webp", key: variant_key(&opts.master_key, width, "webp"), body: webp },
        });
    }

    let (tw, th) = thumbhash_size(master_w, master_h);
    let thumb = resize(&master_pixels, tw, th)?;
    let rgba = to_rgba(thumb.buffer(), channels);
    let hash = thumbhash::rgba_to_thumb_hash(tw as usize, th as usize, &rgba);

    Ok(Processed {
        master: Asset { content_type: master_type, key: opts.master_key.clone(), body: master_body },
        variants,
        width: master_w,
        height: master_h,
        thumbhash: base64::engine::general_purpose::STANDARD.encode(hash),
        animated: false,
    })
}

/// `processAnimatedGif`: `Ok(None)` when the GIF has a single frame (it then goes the still way).
fn process_animated_gif(bytes: &[u8], opts: &Options) -> Result<Option<Processed>, PipelineError> {
    let decoder = image::codecs::gif::GifDecoder::new(Cursor::new(bytes)).map_err(decode_err)?;
    let (w, h) = decoder.dimensions();
    check_bomb(w, h, opts.max_input_pixels)?;
    let mut frames = Vec::new();
    let mut elapsed_ms: f64 = 0.0;
    for frame in decoder.into_frames() {
        let frame = frame.map_err(decode_err)?;
        let (num, den) = frame.delay().numer_denom_ms();
        let timestamp = elapsed_ms.round() as i32;
        elapsed_ms += num as f64 / den.max(1) as f64;
        frames.push((frame.into_buffer(), timestamp));
        // A frame count times the canvas is what really decodes; keep the same guard on the total.
        check_bomb(w, h.saturating_mul(frames.len() as u32), opts.max_input_pixels.saturating_mul(4))?;
    }
    if frames.len() <= 1 {
        return Ok(None);
    }

    let mut config = webp::WebPConfig::new().map_err(|_| PipelineError::Encode("webp config".into()))?;
    config.quality = opts.webp_quality;
    config.method = 4;
    let mut encoder = webp::AnimEncoder::new(w, h, &config);
    encoder.set_loop_count(0);
    for (buffer, timestamp) in &frames {
        encoder.add_frame(webp::AnimFrame::from_rgba(buffer.as_raw(), w, h, *timestamp));
    }
    let body = encoder.try_encode().map_err(|e| PipelineError::Encode(format!("{e:?}")))?.to_vec();

    // ThumbHash from the first frame, `resize({ width: min(w, 100) })` (height follows).
    let tw = w.min(THUMBHASH_MAX_DIMENSION);
    let th = round_half_up(h as f64 * tw as f64 / w as f64).max(1);
    let first = fr::images::Image::from_vec_u8(w, h, frames[0].0.as_raw().clone(), fr::PixelType::U8x4)
        .map_err(decode_err)?;
    let thumb = resize(&first, tw, th)?;
    let hash = thumbhash::rgba_to_thumb_hash(tw as usize, th as usize, thumb.buffer());

    let key = match opts.master_key.rfind('.') {
        Some(dot) => format!("{}.webp", &opts.master_key[..dot]),
        None => format!("{}.webp", opts.master_key),
    };
    Ok(Some(Processed {
        master: Asset { content_type: "image/webp", key, body },
        variants: Vec::new(),
        width: w,
        height: h,
        thumbhash: base64::engine::general_purpose::STANDARD.encode(hash),
        animated: true,
    }))
}

fn to_fr_image(img: DynamicImage, alpha: bool) -> fr::images::Image<'static> {
    let (w, h) = (img.width(), img.height());
    if alpha {
        fr::images::Image::from_vec_u8(w, h, img.into_rgba8().into_raw(), fr::PixelType::U8x4).expect("rgba size")
    } else {
        fr::images::Image::from_vec_u8(w, h, img.into_rgb8().into_raw(), fr::PixelType::U8x3).expect("rgb size")
    }
}

fn from_fr_image(img: fr::images::Image<'static>, alpha: bool) -> DynamicImage {
    let (w, h) = (img.width(), img.height());
    let raw = img.into_vec();
    if alpha {
        DynamicImage::ImageRgba8(image::RgbaImage::from_raw(w, h, raw).expect("rgba size"))
    } else {
        DynamicImage::ImageRgb8(image::RgbImage::from_raw(w, h, raw).expect("rgb size"))
    }
}

/// Lanczos3, sharp's default kernel. Same size in and out is a plain copy.
fn resize(src: &fr::images::Image<'_>, w: u32, h: u32) -> Result<fr::images::Image<'static>, PipelineError> {
    if src.width() == w && src.height() == h {
        return fr::images::Image::from_vec_u8(w, h, src.buffer().to_vec(), src.pixel_type()).map_err(decode_err);
    }
    let mut dst = fr::images::Image::new(w, h, src.pixel_type());
    let options = fr::ResizeOptions::new().resize_alg(fr::ResizeAlg::Convolution(fr::FilterType::Lanczos3));
    fr::Resizer::new()
        .resize(src, &mut dst, &options)
        .map_err(|e| PipelineError::Encode(format!("resize: {e}")))?;
    Ok(dst)
}

fn to_rgba(buf: &[u8], channels: usize) -> Vec<u8> {
    if channels == 4 {
        return buf.to_vec();
    }
    let mut out = Vec::with_capacity(buf.len() / 3 * 4);
    for px in buf.chunks_exact(3) {
        out.extend_from_slice(&[px[0], px[1], px[2], 255]);
    }
    out
}

/// mozjpeg with its own defaults (progressive, trellis, optimised scans, table 3, 4:2:0): what
/// sharp's `jpeg({ quality: 90, mozjpeg: true })` asks libvips' mozjpeg for.
fn encode_jpeg(rgb: &[u8], w: u32, h: u32, quality: f32) -> Result<Vec<u8>, PipelineError> {
    std::panic::catch_unwind(|| -> std::io::Result<Vec<u8>> {
        let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
        comp.set_size(w as usize, h as usize);
        comp.set_quality(quality);
        let mut started = comp.start_compress(Vec::new())?;
        started.write_scanlines(rgb)?;
        started.finish()
    })
    .map_err(|_| PipelineError::Encode("jpeg encoder panicked".into()))?
    .map_err(|e| PipelineError::Encode(format!("jpeg: {e}")))
}

/// zlib level 9, no row filter: sharp's `png({ compressionLevel: 9 })` (adaptiveFiltering off).
fn encode_png(pixels: &[u8], w: u32, h: u32, alpha: bool) -> Result<Vec<u8>, PipelineError> {
    use image::ImageEncoder as _;
    let mut out = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new_with_quality(
        &mut out,
        image::codecs::png::CompressionType::Best,
        image::codecs::png::FilterType::NoFilter,
    );
    let color = if alpha { image::ExtendedColorType::Rgba8 } else { image::ExtendedColorType::Rgb8 };
    encoder.write_image(pixels, w, h, color).map_err(|e| PipelineError::Encode(format!("png: {e}")))?;
    Ok(out)
}

fn encode_webp(pixels: &[u8], w: u32, h: u32, alpha: bool, quality: f32, method: i32) -> Result<Vec<u8>, PipelineError> {
    let encoder = if alpha { webp::Encoder::from_rgba(pixels, w, h) } else { webp::Encoder::from_rgb(pixels, w, h) };
    let mut config = webp::WebPConfig::new().map_err(|_| PipelineError::Encode("webp config".into()))?;
    config.quality = quality;
    config.method = method;
    let mem = encoder.encode_advanced(&config).map_err(|e| PipelineError::Encode(format!("webp: {e:?}")))?;
    Ok(mem.to_vec())
}

fn encode_avif(pixels: &[u8], w: u32, h: u32, alpha: bool, opts: &Options) -> Result<Vec<u8>, PipelineError> {
    let encoder = ravif::Encoder::new()
        .with_quality(opts.avif_quality.clamp(1.0, 100.0))
        .with_alpha_quality(100.0)
        .with_speed(opts.rav1e_speed())
        .with_bit_depth(ravif::BitDepth::Eight)
        .with_num_threads(Some(1));
    let (w, h) = (w as usize, h as usize);
    let encoded = if alpha {
        let px: Vec<ravif::RGBA8> = pixels.chunks_exact(4).map(|p| ravif::RGBA8::new(p[0], p[1], p[2], p[3])).collect();
        encoder.encode_rgba(ravif::Img::new(px.as_slice(), w, h))
    } else {
        let px: Vec<ravif::RGB8> = pixels.chunks_exact(3).map(|p| ravif::RGB8::new(p[0], p[1], p[2])).collect();
        encoder.encode_rgb(ravif::Img::new(px.as_slice(), w, h))
    };
    Ok(encoded.map_err(|e| PipelineError::Encode(format!("avif: {e}")))?.avif_file)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn variant_key_matches_constants_ts() {
        assert_eq!(variant_key("stores/x/media/id-name.jpg", 640, "avif"), "stores/x/media/id-name-w640.avif");
        assert_eq!(variant_key("noext", 320, "webp"), "noext-w320.webp");
        assert_eq!(variant_key("a.b/c.png", 1920, "webp"), "a.b/c-w1920.webp");
    }

    #[test]
    fn widths_include_own_width() {
        assert_eq!(variant_widths_for(533), vec![320, 533]);
        assert_eq!(variant_widths_for(640), vec![320, 640]);
        assert_eq!(variant_widths_for(2560), vec![320, 640, 1280, 1920, 2560]);
        assert_eq!(variant_widths_for(200), vec![200]);
    }

    #[test]
    fn master_is_capped_on_long_edge() {
        assert_eq!(master_size(4032, 3024), (2560, 1920));
        assert_eq!(master_size(3024, 4032), (1920, 2560));
        assert_eq!(master_size(6000, 4000), (2560, 1707));
        assert_eq!(master_size(800, 600), (800, 600));
    }

    #[test]
    fn thumbhash_box_is_fit_inside_100() {
        assert_eq!(thumbhash_size(2560, 1920), (100, 75));
        assert_eq!(thumbhash_size(50, 300), (17, 100));
        assert_eq!(thumbhash_size(60, 40), (60, 40));
    }

    #[test]
    fn rav1e_speed_follows_profile() {
        let mut o = Options::new("image/jpeg", "a.jpg");
        assert_eq!(o.rav1e_speed(), 6);
        o.profile = Profile::Bulk;
        assert_eq!(o.rav1e_speed(), 8);
    }
}
