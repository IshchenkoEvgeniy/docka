//! Файловые операции хранилища на обычных путях (`std::fs`).

use super::paths::TEMP_SUFFIX;
use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::Path;
use std::time::SystemTime;

/// Содержимое файла или `None`, если файла нет.
pub fn read(path: &Path) -> std::io::Result<Option<Vec<u8>>> {
    match fs::read(path) {
        Ok(data) => Ok(Some(data)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

/// Атомарная запись: временный файл рядом → запись → сброс на диск → переименование поверх.
/// Читатель (и Syncthing) видит либо старое, либо новое содержимое целиком.
pub fn write_atomic(path: &Path, data: &[u8]) -> std::io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| std::io::Error::new(ErrorKind::InvalidInput, "нет папки"))?;
    fs::create_dir_all(parent)?;
    let mut temp_name = path.file_name().unwrap_or_default().to_os_string();
    temp_name.push(TEMP_SUFFIX);
    let temp = parent.join(temp_name);
    let result = (|| {
        let mut file = File::create(&temp)?;
        file.write_all(data)?;
        file.sync_all()?;
        fs::rename(&temp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

/// Дописывает данные в конец файла и сбрасывает их на диск.
pub fn append(path: &Path, data: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    file.write_all(data)?;
    file.sync_data()
}

/// Удаляет файл; отсутствующий файл — не ошибка. Папки не удаляются (`remove_file` их не трогает).
pub fn remove(path: &Path) -> std::io::Result<()> {
    match fs::remove_file(path) {
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        result => result,
    }
}

/// Имена файлов и папок внутри `path` (без временных файлов), по алфавиту; пусто, если папки нет.
pub fn list(path: &Path) -> std::io::Result<Vec<String>> {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error),
    };
    let mut names = Vec::new();
    for entry in entries {
        if let Some(name) = entry?.file_name().to_str() {
            if !name.ends_with(TEMP_SUFFIX) {
                names.push(name.to_owned());
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Глубина обхода для даты изменения: проект — это data/<устройство>/<файл> и assets/<файл>.
const LATEST_CHANGE_DEPTH: usize = 4;

/// Самое позднее время изменения файлов внутри папки (временные файлы не считаются).
pub fn latest_change(path: &Path) -> std::io::Result<Option<SystemTime>> {
    latest_in(path, LATEST_CHANGE_DEPTH)
}

fn latest_in(path: &Path, depth: usize) -> std::io::Result<Option<SystemTime>> {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    let mut latest: Option<SystemTime> = None;
    for entry in entries {
        let entry = entry?;
        if entry.file_name().to_string_lossy().ends_with(TEMP_SUFFIX) {
            continue;
        }
        let metadata = entry.metadata()?;
        let candidate = if metadata.is_dir() {
            if depth == 0 {
                None
            } else {
                latest_in(&entry.path(), depth - 1)?
            }
        } else {
            Some(metadata.modified()?)
        };
        latest = latest.max(candidate);
    }
    Ok(latest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn чтение_отсутствующего_файла_даёт_none() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(read(&dir.path().join("нет.log")).unwrap(), None);
    }

    #[test]
    fn атомарная_запись_создаёт_папки_и_заменяет_файл() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data").join("pc").join("доска.snapshot");
        write_atomic(&path, b"first").unwrap();
        write_atomic(&path, b"second").unwrap();
        assert_eq!(read(&path).unwrap().as_deref(), Some(&b"second"[..]));
        assert_eq!(
            list(path.parent().unwrap()).unwrap(),
            vec!["доска.snapshot"]
        );
    }

    #[test]
    fn дописывание_накапливает_данные() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data").join("pc").join("b.log");
        append(&path, b"ab").unwrap();
        append(&path, b"cd").unwrap();
        assert_eq!(read(&path).unwrap().as_deref(), Some(&b"abcd"[..]));
    }

    #[test]
    fn удаление_файла_и_отсутствующего_файла() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.log");
        fs::write(&path, b"x").unwrap();
        remove(&path).unwrap();
        assert!(!path.exists());
        remove(&path).unwrap();
    }

    #[test]
    fn папку_удалить_нельзя() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("data");
        fs::create_dir(&sub).unwrap();
        assert!(remove(&sub).is_err());
        assert!(sub.exists());
    }

    #[test]
    fn список_пропускает_временные_файлы_и_сортирует() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["b", "a", "c.log.doska-tmp"] {
            fs::write(dir.path().join(name), b"").unwrap();
        }
        assert_eq!(list(dir.path()).unwrap(), vec!["a", "b"]);
        assert!(list(&dir.path().join("нет")).unwrap().is_empty());
    }

    #[test]
    fn дата_изменения_папки_по_самому_новому_файлу() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(latest_change(&dir.path().join("нет")).unwrap(), None);
        write_atomic(&dir.path().join("data/pc/project.log"), b"1").unwrap();
        let first = latest_change(dir.path()).unwrap().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        write_atomic(&dir.path().join("data/phone/board.log"), b"2").unwrap();
        assert!(latest_change(dir.path()).unwrap().unwrap() > first);
    }
}
