//! Сетевой запрос для превью ссылок (ADR 0005) — единственный сетевой запрос приложения.
//! Узкий: только GET по http/https, тайм-аут, предел размера и числа перенаправлений.

use base64::Engine as _;
use serde::Serialize;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

const MAX_BYTES: usize = 2 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(10);
const MAX_REDIRECTS: usize = 5;
const USER_AGENT: &str = concat!("Doska/", env!("CARGO_PKG_VERSION"), " (link preview)");

/// Ответ сервера для фронтенда: адрес после перенаправлений, тип и тело (base64).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fetched {
    pub final_url: String,
    pub content_type: String,
    pub base64: String,
    /// Тело обрезано по пределу размера (HTML этого хватает, картинке — нет).
    pub truncated: bool,
}

/// Адрес допустим: только http и https, с узлом.
pub fn check_url(raw: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(raw.trim())
        .map_err(|_| "BAD_REQUEST: некорректный адрес".to_string())?;
    match url.scheme() {
        "http" | "https" if url.host_str().is_some() => Ok(url),
        _ => Err("BAD_REQUEST: только адреса http и https".to_string()),
    }
}

/// TLS: rustls с ring и корневыми сертификатами Mozilla — одинаково на всех платформах.
fn tls_config() -> rustls::ClientConfig {
    let roots = rustls::RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions()
        .expect("протоколы TLS по умолчанию")
        .with_root_certificates(roots)
        .with_no_client_auth()
}

fn client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .use_preconfigured_tls(tls_config())
                .timeout(TIMEOUT)
                .redirect(reqwest::redirect::Policy::limited(MAX_REDIRECTS))
                .user_agent(USER_AGENT)
                .build()
                .map_err(|error| format!("NET: {error}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

/// Читает тело, пока не наберётся предел.
async fn read_limited(mut response: reqwest::Response) -> Result<(Vec<u8>, bool), String> {
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("NET: {error}"))?
    {
        let room = MAX_BYTES - body.len();
        if chunk.len() > room {
            body.extend_from_slice(&chunk[..room]);
            return Ok((body, true));
        }
        body.extend_from_slice(&chunk);
    }
    Ok((body, false))
}

#[tauri::command]
pub async fn net_fetch(url: String) -> Result<Fetched, String> {
    let url = check_url(&url)?;
    let response = client()?
        .get(url)
        .send()
        .await
        .map_err(|error| format!("NET: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "NET: сервер ответил {}",
            response.status().as_u16()
        ));
    }
    let final_url = response.url().to_string();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let (body, truncated) = read_limited(response).await?;
    Ok(Fetched {
        final_url,
        content_type,
        base64: base64::engine::general_purpose::STANDARD.encode(body),
        truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_http_and_https() {
        assert!(check_url("https://example.com/a?b=1").is_ok());
        assert!(check_url(" http://example.com ").is_ok());
        assert!(check_url("file:///etc/passwd").is_err());
        assert!(check_url("javascript:alert(1)").is_err());
        assert!(check_url("ftp://example.com").is_err());
        assert!(check_url("не адрес").is_err());
    }

    #[test]
    fn client_builds_with_bundled_roots() {
        assert!(client().is_ok());
    }
}
