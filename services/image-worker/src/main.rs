//! `image-worker process <input> --out <dir> [options]`
//!
//! Runs the upload-time pipeline on one file and writes the cleaned master and every variant
//! into `<dir>`, named as the worker would name them in storage (the master keeps the input's
//! file name; variants are `name-w640.avif` etc.). Prints a JSON summary (the fields
//! `markMediaProcessed` needs) to stdout and also writes it to `<dir>/result.json`.
//!
//! Options:
//!   --content-type <type>   the media row's content type (default: from the file extension)
//!   --profile <p>           interactive (default) | bulk
//!   --avif-speed <1-10>     override the rav1e speed mapped from the profile's effort
//!   --key <name>            master key / file name to write (default: the input's file name)
//!
//! Exit codes: 0 ok, 2 usage, 3 decompression bomb, 4 unsupported format, 1 any other failure.

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use image_worker::{process_image, Options, PipelineError, Processed, Profile};

fn usage() -> ExitCode {
    eprintln!(
        "usage: image-worker process <input> --out <dir> [--content-type <type>] [--profile interactive|bulk] [--avif-speed <1-10>] [--key <name>]"
    );
    ExitCode::from(2)
}

fn content_type_for(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("avif") => "image/avif",
        Some("heic") | Some("heif") => "image/heic",
        _ => "image/jpeg", // the worker's own fallback when a row has no content type
    }
}

fn json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn summary_json(p: &Processed) -> String {
    let variants: Vec<String> = p
        .variants
        .iter()
        .map(|v| {
            format!(
                "{{\"width\":{},\"height\":{},\"avif\":{{\"key\":{},\"bytes\":{}}},\"webp\":{{\"key\":{},\"bytes\":{}}}}}",
                v.width,
                v.height,
                json_string(&v.avif.key),
                v.avif.body.len(),
                json_string(&v.webp.key),
                v.webp.body.len()
            )
        })
        .collect();
    format!(
        "{{\"master\":{{\"key\":{},\"contentType\":{},\"bytes\":{}}},\"width\":{},\"height\":{},\"thumbhash\":{},\"animated\":{},\"variants\":[{}]}}",
        json_string(&p.master.key),
        json_string(p.master.content_type),
        p.master.body.len(),
        p.width,
        p.height,
        json_string(&p.thumbhash),
        p.animated,
        variants.join(",")
    )
}

fn file_name(key: &str) -> &str {
    key.rsplit(['/', '\\']).next().unwrap_or(key)
}

fn run(args: &[String]) -> Result<(), ExitCode> {
    if args.first().map(String::as_str) != Some("process") || args.len() < 2 {
        return Err(usage());
    }
    let input = PathBuf::from(&args[1]);
    let mut out: Option<PathBuf> = None;
    let mut content_type: Option<String> = None;
    let mut profile = Profile::Interactive;
    let mut avif_speed: Option<u8> = None;
    let mut key: Option<String> = None;
    let mut i = 2;
    while i < args.len() {
        let value = args.get(i + 1).cloned();
        match (args[i].as_str(), value) {
            ("--out", Some(v)) => out = Some(PathBuf::from(v)),
            ("--content-type", Some(v)) => content_type = Some(v),
            ("--profile", Some(v)) if v == "bulk" => profile = Profile::Bulk,
            ("--profile", Some(v)) if v == "interactive" => profile = Profile::Interactive,
            ("--avif-speed", Some(v)) => avif_speed = Some(v.parse().map_err(|_| usage())?),
            ("--key", Some(v)) => key = Some(v),
            _ => return Err(usage()),
        }
        i += 2;
    }
    let out = out.ok_or_else(usage)?;

    let bytes = std::fs::read(&input).map_err(|e| {
        eprintln!("could not read {}: {e}", input.display());
        ExitCode::from(1)
    })?;
    let key = key.unwrap_or_else(|| input.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
    let mut opts = Options::new(content_type.as_deref().unwrap_or_else(|| content_type_for(&input)), &key);
    opts.profile = profile;
    opts.avif_speed = avif_speed;

    let processed = process_image(&bytes, &opts).map_err(|e| {
        eprintln!("{e}");
        ExitCode::from(match e {
            PipelineError::DecompressionBomb { .. } => 3,
            PipelineError::Unsupported(_) => 4,
            _ => 1,
        })
    })?;
    drop(bytes);

    std::fs::create_dir_all(&out).map_err(|e| {
        eprintln!("could not create {}: {e}", out.display());
        ExitCode::from(1)
    })?;
    let write = |name: &str, body: &[u8]| {
        std::fs::write(out.join(file_name(name)), body).map_err(|e| {
            eprintln!("could not write {name}: {e}");
            ExitCode::from(1)
        })
    };
    write(&processed.master.key, &processed.master.body)?;
    for v in &processed.variants {
        write(&v.avif.key, &v.avif.body)?;
        write(&v.webp.key, &v.webp.body)?;
    }
    let summary = summary_json(&processed);
    write("result.json", summary.as_bytes())?;
    println!("{summary}");
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(code) => code,
    }
}
