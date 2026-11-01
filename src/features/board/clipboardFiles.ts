/** Некоторые мобильные WebView заполняют items, оставляя FileList пустым. */
export function clipboardFiles(data: DataTransfer): File[] {
  if (data.files.length > 0) return [...data.files];
  return [...data.items].flatMap((item) => {
    if (item.kind !== 'file') return [];
    const file = item.getAsFile();
    return file === null ? [] : [file];
  });
}
