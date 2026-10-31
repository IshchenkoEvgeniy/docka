//! Папки проектов, которые пользователь открыл в этом запуске. Команды хранилища работают
//! только внутри них — даже если во фронтенд попадёт вредный код, он не прочитает чужие файлы.

use super::paths::resolve_inside;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default)]
pub struct ProjectRoots(Mutex<HashSet<PathBuf>>);

impl ProjectRoots {
    /// Регистрирует существующую папку и возвращает её канонический путь — его фронтенд
    /// передаёт во все остальные команды.
    pub fn open(&self, path: &str) -> Result<PathBuf, String> {
        let canonical = dunce::canonicalize(path).map_err(|e| format!("NOT_FOUND: {path}: {e}"))?;
        if !canonical.is_dir() {
            return Err(format!("NOT_A_FOLDER: {path}"));
        }
        self.lock()?.insert(canonical.clone());
        Ok(canonical)
    }

    /// Открытая ранее папка проекта.
    pub fn root(&self, root: &str) -> Result<PathBuf, String> {
        let root = PathBuf::from(root);
        if self.lock()?.contains(&root) {
            Ok(root)
        } else {
            Err("ROOT_NOT_OPEN: папка проекта не открыта".into())
        }
    }

    /// Путь внутри открытой папки проекта; пустой относительный путь — сама папка.
    pub fn resolve(&self, root: &str, relative: &str) -> Result<PathBuf, String> {
        let root = self.root(root)?;
        if relative.is_empty() {
            Ok(root)
        } else {
            resolve_inside(&root, relative)
        }
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, HashSet<PathBuf>>, String> {
        self.0
            .lock()
            .map_err(|_| "INTERNAL: реестр папок повреждён".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn работает_только_с_открытыми_папками() {
        let dir = tempfile::tempdir().unwrap();
        let roots = ProjectRoots::default();
        let raw = dir.path().to_str().unwrap();
        assert!(roots.resolve(raw, "data").is_err());

        let canonical = roots.open(raw).unwrap();
        let canonical = canonical.to_str().unwrap();
        assert!(roots.resolve(canonical, "data/pc/a.log").is_ok());
        assert!(roots.resolve(canonical, "../x").is_err());
    }

    #[test]
    fn не_открывает_файл_или_несуществующую_папку() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.txt");
        std::fs::write(&file, b"").unwrap();
        let roots = ProjectRoots::default();
        assert!(roots.open(file.to_str().unwrap()).is_err());
        assert!(roots
            .open(dir.path().join("нет").to_str().unwrap())
            .is_err());
    }
}
