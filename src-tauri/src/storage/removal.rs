use super::roots::ProjectRoots;

/// Корень не удаляется даже через эквивалентный ему относительный путь.
pub fn remove_directory(roots: &ProjectRoots, root: &str, path: &str) -> Result<(), String> {
    let boundary = roots.root(root)?;
    let target = roots.resolve(root, path)?;
    if target == boundary {
        return Err("INVALID_PATH: нельзя удалить корень".into());
    }
    let canonical = match dunce::canonicalize(&target) {
        Ok(path) => path,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("IO: {error}")),
    };
    if canonical == boundary || !canonical.starts_with(&boundary) {
        return Err("INVALID_PATH: папка находится вне открытого корня".into());
    }
    if std::fs::symlink_metadata(&target)
        .map_err(|error| format!("IO: {error}"))?
        .file_type()
        .is_symlink()
    {
        return Err("INVALID_PATH: нельзя рекурсивно удалить ссылку на папку".into());
    }
    match std::fs::remove_dir_all(target) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        result => result.map_err(|error| format!("IO: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn удаляет_только_выбранную_подпапку() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("game/assets")).unwrap();
        std::fs::write(dir.path().join("game/assets/image.png"), b"image").unwrap();
        std::fs::write(dir.path().join("neighbour"), b"keep").unwrap();
        let roots = ProjectRoots::default();
        let root = roots.open(dir.path().to_str().unwrap()).unwrap();
        remove_directory(&roots, root.to_str().unwrap(), "game").unwrap();
        assert!(!dir.path().join("game").exists());
        assert!(dir.path().join("neighbour").exists());
        remove_directory(&roots, root.to_str().unwrap(), "game").unwrap();
    }

    #[test]
    fn защищает_корень_и_соседей() {
        let dir = tempfile::tempdir().unwrap();
        let roots = ProjectRoots::default();
        let root = roots.open(dir.path().to_str().unwrap()).unwrap();
        for path in ["", ".", "..", "../other", "/other"] {
            assert!(remove_directory(&roots, root.to_str().unwrap(), path).is_err());
        }
        assert!(dir.path().exists());
    }
}
