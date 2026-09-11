use rand::RngExt;
use std::time::{SystemTime, UNIX_EPOCH};
use totp_rs::{Algorithm, Builder, Secret};

pub struct TotpSetup {
    pub secret: String,
    pub otpauth_url: String,
    pub qr_data_url: String,
    pub recovery_codes: Vec<String>,
}

/// Generates a new TOTP secret, QR code data URL, otpauth URL, and 8 recovery codes
pub fn generate_totp_setup(username: &str) -> Result<TotpSetup, String> {
    let secret = Secret::generate();
    let secret_base32 = secret.to_base32();

    let totp = Builder::new()
        .with_algorithm(Algorithm::SHA1)
        .with_digits(6)
        .with_skew(1)
        .with_step_duration(30)
        .with_secret(secret)
        .with_issuer(Some("Orbit Dashboard".to_string()))
        .with_account_name(username.to_string())
        .build()
        .map_err(|e| format!("Failed to create TOTP instance: {}", e))?;

    let otpauth_url = totp.to_url().map_err(|e| format!("Failed to generate otpauth URL: {}", e))?;
    let qr_base64 = totp.to_qr_base64().map_err(|e| format!("Failed to generate QR code: {}", e))?;
    let qr_data_url = format!("data:image/png;base64,{}", qr_base64);

    let recovery_codes = generate_recovery_codes(8);

    Ok(TotpSetup {
        secret: secret_base32,
        otpauth_url,
        qr_data_url,
        recovery_codes,
    })
}

/// Verifies a 6-digit TOTP code against the Base32 secret with +/- 30s tolerance
pub fn verify_totp_code(secret_base32: &str, username: &str, code: &str) -> bool {
    let clean_code = code.trim().replace(' ', "").replace('-', "");
    if clean_code.len() != 6 {
        return false;
    }

    let secret = match Secret::try_from_base32(secret_base32) {
        Ok(s) => s,
        Err(_) => return false,
    };

    let totp = match Builder::new()
        .with_algorithm(Algorithm::SHA1)
        .with_digits(6)
        .with_skew(1)
        .with_step_duration(30)
        .with_secret(secret)
        .with_issuer(Some("Orbit Dashboard".to_string()))
        .with_account_name(username.to_string())
        .build()
    {
        Ok(t) => t,
        Err(_) => return false,
    };

    let now = match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(d) => d.as_secs(),
        Err(_) => return false,
    };

    totp.check(&clean_code, now).is_some()
}

/// Generates alphanumeric single-use recovery codes in the format ABCD-1234
pub fn generate_recovery_codes(count: usize) -> Vec<String> {
    const CHARSET: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let mut rng = rand::rng();
    let mut codes = Vec::with_capacity(count);

    for _ in 0..count {
        let part1: String = (0..4)
            .map(|_| {
                let idx = rng.random_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect();

        let part2: String = (0..4)
            .map(|_| {
                let idx = rng.random_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect();

        codes.push(format!("{}-{}", part1, part2));
    }

    codes
}

/// Computes SHA-256 hash of a recovery code for secure persistent storage
pub fn hash_recovery_code(code: &str) -> String {
    use argon2::password_hash::rand_core::OsRng;
    use argon2::password_hash::{PasswordHasher, SaltString};
    use argon2::Argon2;

    let clean = code.trim().replace(' ', "").to_uppercase();
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(clean.as_bytes(), &salt)
        .map(|h| h.to_string())
        .unwrap_or_else(|_| clean)
}

/// Checks if the provided code matches any stored recovery code hash.
/// If matched, removes the consumed code from the list in-place and returns true.
pub fn verify_and_consume_recovery_code(hashes: &mut Vec<String>, code: &str) -> bool {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    use argon2::Argon2;

    let clean = code.trim().replace(' ', "").to_uppercase();
    if clean.len() < 8 {
        return false;
    }

    let mut matched_index = None;
    for (i, hash_str) in hashes.iter().enumerate() {
        if let Ok(parsed_hash) = PasswordHash::new(hash_str) {
            if Argon2::default().verify_password(clean.as_bytes(), &parsed_hash).is_ok() {
                matched_index = Some(i);
                break;
            }
        } else if hash_str == &clean {
            matched_index = Some(i);
            break;
        }
    }

    if let Some(idx) = matched_index {
        hashes.remove(idx);
        true
    } else {
        false
    }
}
