//! Проверка путей: фронтенд передаёт путь внутри проекта, Rust не даёт выйти за пределы
//! открытой пользователем папки.

use std::path::{Path, PathBuf};

/// Суффикс временных файлов атомарной записи. Такие файлы не попадают в события слежения.
pub const TEMP_SUFFIX: &str = ".doska-tmp";

/// Превращает относительный путь вида `data/pc/board.log` в путь внутри `root`.
/// Отклоняет пустые, абсолютные пути, `.` и `..`, обратные слэши, двоеточия и управляющие символы.
pub fn resolve_inside(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() {
        return Err("INVALID_PATH: пустой путь".into());
    }
    let mut result = root.to_path_buf();
    for segment in relative.split('/') {
        let invalid = segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment.ends_with(TEMP_SUFFIX)
            || segment
                .chars()
                .any(|c| c == '\\' || c == ':' || c.is_control());
        if invalid {
            return Err(format!("INVALID_PATH: недопустимый путь «{relative}»"));
        }
        result.push(segment);
    }
    Ok(result)
}

/// Путь `path` относительно `root` с разделителем `/`, если он внутри `root`.
pub fn relative_to(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    let parts: Option<Vec<&str>> = relative
        .components()
        .map(|c| c.as_os_str().to_str())
        .collect();
    let joined = parts?.join("/");
    (!joined.is_empty()).then_some(joined)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        PathBuf::from("projects").join("Игра.doska")
    }

    #[test]
    fn принимает_обычные_пути_включая_кириллицу() {
        let resolved = resolve_inside(&root(), "data/pc-1/доска.log").unwrap();
        assert_eq!(resolved, root().join("data").join("pc-1").join("доска.log"));
    }

    #[test]
    fn отклоняет_выход_за_пределы_проекта() {
        for bad in [
            "",
            "/etc/passwd",
            "../secret",
            "data/../../x",
            "data//x",
            "./x",
            "C:/x",
            "data\\x",
            "a/\u{0}b",
        ] {
            assert!(
                resolve_inside(&root(), bad).is_err(),
                "должен отклонить {bad:?}"
            );
        }
    }

    #[test]
    fn не_даёт_писать_во_временные_файлы_напрямую() {
        assert!(resolve_inside(&root(), "data/a.log.doska-tmp").is_err());
    }

    #[test]
    fn относительный_путь_со_слэшами() {
        let path = root().join("data").join("phone").join("b.log");
        assert_eq!(
            relative_to(&root(), &path).as_deref(),
            Some("data/phone/b.log")
        );
        assert_eq!(relative_to(&root(), &PathBuf::from("elsewhere")), None);
    }
}
