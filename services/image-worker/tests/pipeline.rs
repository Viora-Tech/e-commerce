//! Mirrors packages/core/src/media/pipeline.test.ts case by case.

use std::io::Cursor;

use base64::Engine as _;
use image::{codecs::gif::GifEncoder, Delay, DynamicImage, Frame, ImageFormat, Rgb, RgbImage, Rgba, RgbaImage};
use image_worker::{process_image, variant_key, Options, PipelineError, Profile, MAX_MASTER_LONG_EDGE};

fn gradient(w: u32, h: u32) -> RgbImage {
    RgbImage::from_fn(w, h, |x, y| Rgb([(x * 255 / w.max(1)) as u8, (y * 255 / h.max(1)) as u8, 90]))
}

fn encode(img: DynamicImage, format: ImageFormat) -> Vec<u8> {
    let mut out = Cursor::new(Vec::new());
    img.write_to(&mut out, format).unwrap();
    out.into_inner()
}

/// A JPEG with an EXIF block holding orientation 6 (rotate 90 CW) and a GPS-looking string.
fn jpeg_with_exif_rotation(w: u32, h: u32) -> Vec<u8> {
    let jpeg = encode(DynamicImage::ImageRgb8(gradient(w, h)), ImageFormat::Jpeg);
    let mut tiff = Vec::new();
    tiff.extend_from_slice(b"MM\0\x2a\0\0\0\x08"); // big-endian TIFF, IFD0 at 8
    tiff.extend_from_slice(&2u16.to_be_bytes()); // two entries
    tiff.extend_from_slice(&[0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1, 0x00, 0x06, 0, 0]); // Orientation = 6
    let text = b"GPS 12/1 34/1 77/1 35/1\0";
    let text_offset = 8 + 2 + 12 * 2 + 4;
    tiff.extend_from_slice(&[0x01, 0x31, 0x00, 0x02]); // Software (ASCII)
    tiff.extend_from_slice(&(text.len() as u32).to_be_bytes());
    tiff.extend_from_slice(&(text_offset as u32).to_be_bytes());
    tiff.extend_from_slice(&0u32.to_be_bytes()); // no next IFD
    tiff.extend_from_slice(text);
    let mut app1 = b"Exif\0\0".to_vec();
    app1.extend_from_slice(&tiff);
    let mut out = jpeg[..2].to_vec(); // SOI
    out.extend_from_slice(&[0xFF, 0xE1]);
    out.extend_from_slice(&((app1.len() + 2) as u16).to_be_bytes());
    out.extend_from_slice(&app1);
    out.extend_from_slice(&jpeg[2..]);
    out
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

fn dims(bytes: &[u8]) -> (u32, u32) {
    let img = image::load_from_memory(bytes).unwrap();
    (img.width(), img.height())
}

#[test]
fn auto_orients_strips_metadata_and_never_upscales() {
    let input = jpeg_with_exif_rotation(400, 300);
    assert!(contains(&input, b"GPS 12/1"));
    let out = process_image(&input, &Options::new("image/jpeg", "stores/s/media/a.jpg")).unwrap();
    assert_eq!((out.width, out.height), (300, 400)); // upright
    assert_eq!(dims(&out.master.body), (300, 400));
    assert_eq!(out.master.content_type, "image/jpeg");
    for body in std::iter::once(&out.master.body).chain(out.variants.iter().flat_map(|v| [&v.avif.body, &v.webp.body])) {
        assert!(!contains(body, b"Exif"), "metadata left in an output");
        assert!(!contains(body, b"GPS 12/1"), "GPS left in an output");
    }
    assert_eq!(out.variants.iter().map(|v| v.width).collect::<Vec<_>>(), vec![300]);
    // Upright: the left edge of the stored image (dark red) is now the top row.
    let master = image::load_from_memory(&out.master.body).unwrap().to_rgb8();
    let top = master.get_pixel(150, 2);
    let bottom = master.get_pixel(150, 397);
    assert!(top[0] < bottom[0], "rotation not applied: top {top:?} bottom {bottom:?}");
}

#[test]
fn caps_master_and_skips_widths_above_it() {
    let input = encode(DynamicImage::ImageRgb8(gradient(3000, 1000)), ImageFormat::Png);
    let out = process_image(&input, &Options::new("image/png", "m.png")).unwrap();
    assert_eq!(out.width, MAX_MASTER_LONG_EDGE);
    assert_eq!(out.height, 853);
    assert_eq!(out.master.content_type, "image/png");
    assert_eq!(dims(&out.master.body), (2560, 853));
    assert_eq!(out.variants.iter().map(|v| v.width).collect::<Vec<_>>(), vec![320, 640, 1280, 1920, 2560]);
}

#[test]
fn small_source_gets_only_its_own_width() {
    let input = encode(DynamicImage::ImageRgb8(gradient(200, 100)), ImageFormat::Jpeg);
    let out = process_image(&input, &Options::new("image/jpeg", "s.jpg")).unwrap();
    assert_eq!(out.variants.len(), 1);
    assert_eq!((out.variants[0].width, out.variants[0].height), (200, 100));
}

#[test]
fn avif_and_webp_per_width_keyed_off_master() {
    let input = encode(DynamicImage::ImageRgb8(gradient(700, 350)), ImageFormat::Jpeg);
    let key = "stores/s/media/id-shoe.jpg";
    let out = process_image(&input, &Options::new("image/jpeg", key)).unwrap();
    assert_eq!(out.variants.iter().map(|v| v.width).collect::<Vec<_>>(), vec![320, 640, 700]);
    for v in &out.variants {
        assert_eq!(v.avif.key, variant_key(key, v.width, "avif"));
        assert_eq!(v.webp.key, variant_key(key, v.width, "webp"));
        assert_eq!(&v.avif.body[4..12], b"ftypavif");
        assert_eq!(&v.webp.body[0..4], b"RIFF");
        assert_eq!(&v.webp.body[8..12], b"WEBP");
        assert_eq!(dims(&v.webp.body), (v.width, v.height));
    }
    assert_eq!(out.variants[0].avif.key, "stores/s/media/id-shoe-w320.avif");
}

#[test]
fn keeps_alpha_in_png_master_and_variants() {
    let img = RgbaImage::from_fn(400, 400, |x, _| Rgba([200, 30, 30, if x < 200 { 255 } else { 0 }]));
    let input = encode(DynamicImage::ImageRgba8(img), ImageFormat::Png);
    let out = process_image(&input, &Options::new("image/png", "c.png")).unwrap();
    let master = image::load_from_memory(&out.master.body).unwrap();
    assert!(master.color().has_alpha());
    let webp = image::load_from_memory(&out.variants[0].webp.body).unwrap();
    assert!(webp.color().has_alpha());
}

#[test]
fn thumbhash_decodes() {
    let input = encode(DynamicImage::ImageRgb8(gradient(800, 600)), ImageFormat::Jpeg);
    let out = process_image(&input, &Options::new("image/jpeg", "t.jpg")).unwrap();
    let hash = base64::engine::general_purpose::STANDARD.decode(&out.thumbhash).unwrap();
    let (w, h, rgba) = thumbhash::thumb_hash_to_rgba(&hash).unwrap();
    assert!(w > 0 && h > 0 && w > h, "landscape placeholder, got {w}x{h}");
    assert_eq!(rgba.len(), w * h * 4);
}

#[test]
fn rejects_decompression_bomb_before_decoding() {
    let input = encode(DynamicImage::ImageRgb8(gradient(100, 100)), ImageFormat::Png);
    let mut opts = Options::new("image/png", "b.png");
    opts.max_input_pixels = 5_000;
    match process_image(&input, &opts) {
        Err(PipelineError::DecompressionBomb { width: 100, height: 100, .. }) => {}
        other => panic!("expected a bomb rejection, got {other:?}"),
    }
}

#[test]
fn animated_gif_becomes_one_animated_webp_master() {
    let mut bytes = Vec::new();
    {
        let mut enc = GifEncoder::new(&mut bytes);
        enc.set_repeat(image::codecs::gif::Repeat::Infinite).unwrap();
        for i in 0..3u8 {
            let frame = RgbaImage::from_pixel(40, 30, Rgba([i * 80, 100, 200 - i * 60, 255]));
            enc.encode_frame(Frame::from_parts(frame, 0, 0, Delay::from_numer_denom_ms(100, 1))).unwrap();
        }
    }
    let out = process_image(&bytes, &Options::new("image/gif", "stores/s/media/spin.gif")).unwrap();
    assert!(out.animated);
    assert!(out.variants.is_empty());
    assert_eq!(out.master.key, "stores/s/media/spin.webp");
    assert_eq!(out.master.content_type, "image/webp");
    assert!(contains(&out.master.body, b"ANIM"));
    assert_eq!((out.width, out.height), (40, 30));
}

#[test]
fn still_gif_takes_the_still_path() {
    let input = encode(DynamicImage::ImageRgb8(gradient(64, 48)), ImageFormat::Gif);
    let out = process_image(&input, &Options::new("image/gif", "g.gif")).unwrap();
    assert!(!out.animated);
    assert_eq!(out.master.content_type, "image/png");
    assert_eq!(out.variants.len(), 1);
}

#[test]
fn refuses_svg_announced_as_png() {
    let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>"#;
    assert!(matches!(process_image(svg, &Options::new("image/png", "x.png")), Err(PipelineError::Unsupported(_))));
}

#[test]
fn bulk_profile_gives_same_widths_and_formats() {
    let input = encode(DynamicImage::ImageRgb8(gradient(700, 350)), ImageFormat::Jpeg);
    let interactive = process_image(&input, &Options::new("image/jpeg", "p.jpg")).unwrap();
    let mut opts = Options::new("image/jpeg", "p.jpg");
    opts.profile = Profile::Bulk;
    let bulk = process_image(&input, &opts).unwrap();
    let widths = |p: &image_worker::Processed| p.variants.iter().map(|v| v.width).collect::<Vec<_>>();
    assert_eq!(widths(&interactive), widths(&bulk));
}
