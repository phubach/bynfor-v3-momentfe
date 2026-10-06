export function videoFileError(file: File | null | undefined): string | null {
  if (!file) return null;
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const extOk = /\.(mp4|mov|webm|m3u8|avi|mkv|3gp|m4v)$/i.test(name);
  const mimeOk = !mime || mime === 'application/octet-stream' || mime.startsWith('video/');
  if (!mimeOk && !extOk) return 'toastr.error.select_valid_video_file';
  if (file.size / 1000 > 10240) return 'toastr.error.video_size';
  return null;
}
