use axum::{
    extract::{Multipart, Query},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use super::path_utils::{get_mime_type, sanitize_path, to_display_path};
use super::types::{CompressRequest, DownloadQuery, ExtractRequest, UploadQuery};

pub async fn download_file(Query(q): Query<DownloadQuery>) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("file");
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let mime = get_mime_type(ext);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", file_name).parse().unwrap(),
    );
    headers.insert(header::CONTENT_LENGTH, contents.len().to_string().parse().unwrap());

    Ok((headers, contents).into_response())
}

pub async fn archive_folder(Query(q): Query<DownloadQuery>) -> Result<Response, StatusCode> {
    let path = sanitize_path(&q.path)?;
    if !path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut zip_buf = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut zip_buf);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        fn add_dir_to_zip(
            zip: &mut zip::ZipWriter<&mut std::io::Cursor<Vec<u8>>>,
            dir_path: &Path,
            prefix: &Path,
            options: zip::write::SimpleFileOptions,
        ) -> std::io::Result<()> {
            for entry in fs::read_dir(dir_path)? {
                let entry = entry?;
                let path = entry.path();
                let name = path.strip_prefix(prefix).unwrap();
                if path.is_dir() {
                    zip.add_directory(name.to_string_lossy(), options)?;
                    add_dir_to_zip(zip, &path, prefix, options)?;
                } else {
                    zip.start_file(name.to_string_lossy(), options)?;
                    let mut f = File::open(&path)?;
                    let mut buf = Vec::new();
                    f.read_to_end(&mut buf)?;
                    zip.write_all(&buf)?;
                }
            }
            Ok(())
        }

        if path.is_dir() {
            let _ = add_dir_to_zip(&mut zip, &path, &path, options);
        } else {
            let name = path.file_name().unwrap().to_string_lossy();
            let _ = zip.start_file(name, options);
            let mut f = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let mut buf = Vec::new();
            let _ = f.read_to_end(&mut buf);
            let _ = zip.write_all(&buf);
        }
        let _ = zip.finish();
    }

    let result_bytes = zip_buf.into_inner();
    let folder_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("archive");

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "application/zip".parse().unwrap());
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}.zip\"", folder_name).parse().unwrap(),
    );
    headers.insert(header::CONTENT_LENGTH, result_bytes.len().to_string().parse().unwrap());

    Ok((headers, result_bytes).into_response())
}

pub async fn upload_files(
    Query(q): Query<UploadQuery>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let dest_dir = q.destination.unwrap_or_else(|| "/DATA".to_string());
    let target_dir = sanitize_path(&dest_dir)?;
    let _ = fs::create_dir_all(&target_dir);

    let mut uploaded_files = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let file_name = field.file_name().unwrap_or("uploaded_file").to_string();
        let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
        
        let file_path = target_dir.join(&file_name);
        fs::write(&file_path, data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        uploaded_files.push(file_name);
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "uploaded": uploaded_files,
        "destination": target_dir.to_string_lossy()
    })))
}

pub async fn extract_archive(Json(req): Json<ExtractRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    let path = sanitize_path(&req.path)?;
    if !path.exists() || path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let dest_dir = if let Some(ref d) = req.destination {
        sanitize_path(d)?
    } else {
        path.parent().unwrap_or(Path::new("/")).to_path_buf()
    };

    let _ = fs::create_dir_all(&dest_dir);

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let mut extracted_count = 0;

    if ext == "zip" {
        let file = File::open(&path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let mut archive = zip::ZipArchive::new(file).map_err(|_| StatusCode::BAD_REQUEST)?;

        for i in 0..archive.len() {
            let mut file_in_zip = archive.by_index(i).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let outpath = match file_in_zip.enclosed_name() {
                Some(p) => dest_dir.join(p),
                None => continue,
            };

            if file_in_zip.is_dir() {
                let _ = fs::create_dir_all(&outpath);
            } else {
                if let Some(parent) = outpath.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let mut outfile = File::create(&outpath).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                std::io::copy(&mut file_in_zip, &mut outfile).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                extracted_count += 1;
            }
        }
    } else {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "extracted_to": dest_dir.to_string_lossy(),
        "files_count": extracted_count
    })))
}

pub async fn compress_files(Json(req): Json<CompressRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.paths.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let dest_dir = if let Some(ref d) = req.destination_dir {
        sanitize_path(d)?
    } else {
        let first = sanitize_path(&req.paths[0])?;
        first.parent().unwrap_or(Path::new("/")).to_path_buf()
    };

    let zip_filename = if req.destination_name.ends_with(".zip") {
        req.destination_name.clone()
    } else {
        format!("{}.zip", req.destination_name)
    };

    let zip_path = dest_dir.join(&zip_filename);
    let zip_file = File::create(&zip_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut zip_writer = zip::ZipWriter::new(zip_file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    fn add_to_zip(
        zip: &mut zip::ZipWriter<File>,
        src_path: &Path,
        prefix_in_zip: &str,
        options: zip::write::SimpleFileOptions,
    ) -> std::io::Result<()> {
        let name = src_path.file_name().unwrap_or_default().to_string_lossy();
        let zip_entry_name = if prefix_in_zip.is_empty() {
            name.to_string()
        } else {
            format!("{}/{}", prefix_in_zip, name)
        };

        if src_path.is_dir() {
            zip.add_directory(&zip_entry_name, options)?;
            for entry in fs::read_dir(src_path)? {
                let entry = entry?;
                add_to_zip(zip, &entry.path(), &zip_entry_name, options)?;
            }
        } else {
            zip.start_file(&zip_entry_name, options)?;
            let mut f = File::open(src_path)?;
            let mut buf = Vec::new();
            f.read_to_end(&mut buf)?;
            zip.write_all(&buf)?;
        }
        Ok(())
    }

    for p in &req.paths {
        let target = sanitize_path(p)?;
        if target.exists() {
            let _ = add_to_zip(&mut zip_writer, &target, "", options);
        }
    }

    zip_writer.finish().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let size = zip_path.metadata().map(|m| m.len()).unwrap_or(0);

    Ok(Json(serde_json::json!({
        "success": true,
        "archive_path": to_display_path(&zip_path),
        "size": size
    })))
}
