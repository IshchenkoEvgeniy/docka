//! Хранилище проекта на диске: безопасные пути, атомарная запись, слежение за папкой.

pub mod commands;
mod files;
mod paths;
mod roots;
mod watch;

#[cfg(test)]
mod ipc_tests;

pub use roots::ProjectRoots;
pub use watch::Watchers;
