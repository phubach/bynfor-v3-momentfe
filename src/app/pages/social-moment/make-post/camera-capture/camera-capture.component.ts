import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

export interface CapturedMedia {
  file: File;
  preview: string;
  kind: 'photo' | 'video';
}

/**
 * Modal camera thật (gọn theo image-live + video-live của customerfe):
 * - photo: preview live -> chụp qua canvas -> File jpeg
 * - video: preview live -> ghi bằng MediaRecorder -> File webm
 */
@Component({
  selector: 'app-camera-capture',
  standalone: false,
  templateUrl: './camera-capture.component.html',
  styleUrls: ['./camera-capture.component.scss'],
})
export class CameraCaptureComponent implements OnInit, OnDestroy {
  @Input() mode: 'photo' | 'video' = 'photo';
  @Output() captured = new EventEmitter<CapturedMedia>();
  @Output() closed = new EventEmitter<void>();

  starting = true;
  error = '';
  photoPreview: string | null = null;
  recording = false;
  recordSecs = 0;
  recordedUrl: string | null = null;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: any = null;

  ngOnInit(): void {
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopTracks();
    clearInterval(this.timer);
  }

  get titleKey(): string {
    return this.mode === 'photo' ? 'social.takePhoto' : 'social.takeVideo';
  }

  private async startCamera(): Promise<void> {
    this.starting = true;
    this.error = '';
    try {
      const constraints: MediaStreamConstraints =
        this.mode === 'photo'
          ? { audio: { echoCancellation: false } as any, video: { width: 640, height: 480 } }
          : { audio: { echoCancellation: true } as any, video: { width: 1280, height: 720 } };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      const el = document.getElementById('capture-live-video') as HTMLVideoElement;
      if (el) {
        el.srcObject = this.stream;
        try {
          await el.play();
        } catch {}
      }
    } catch {
      this.error = 'social.cameraError';
    } finally {
      this.starting = false;
    }
  }

  private stopTracks(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  close(): void {
    this.stopTracks();
    clearInterval(this.timer);
    this.closed.emit();
  }

  // ---------- photo ----------

  capturePhoto(): void {
    const video = document.getElementById('capture-live-video') as HTMLVideoElement;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    this.photoPreview = canvas.toDataURL('image/jpeg');
  }

  retakePhoto(): void {
    this.photoPreview = null;
  }

  usePhoto(): void {
    if (!this.photoPreview) return;
    const [head, data] = this.photoPreview.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(data);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const file = new File([arr], `${Date.now()}_screenshoot.jpeg`, { type: mime });
    this.captured.emit({ file, preview: this.photoPreview, kind: 'photo' });
    this.close();
  }

  // ---------- video ----------

  toggleRecord(): void {
    if (this.recording) this.stopRecording();
    else this.startRecording();
  }

  private pickMime(): string {
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    for (const m of candidates) {
      try {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
      } catch {}
    }
    return '';
  }

  private startRecording(): void {
    if (!this.stream) return;
    this.chunks = [];
    const mime = this.pickMime();
    try {
      this.recorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    } catch {
      this.error = 'social.cameraError';
      return;
    }
    this.recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.recording = true;
    this.recordSecs = 0;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.recordSecs++, 1000);
  }

  private stopRecording(): void {
    try {
      this.recorder?.stop();
    } catch {}
    clearInterval(this.timer);
    this.recording = false;
    setTimeout(() => {
      const type = this.chunks[0]?.type || 'video/webm';
      const blob = new Blob(this.chunks, { type });
      this.recordedUrl = URL.createObjectURL(blob);
    }, 100);
  }

  retakeVideo(): void {
    if (this.recordedUrl) URL.revokeObjectURL(this.recordedUrl);
    this.recordedUrl = null;
    this.chunks = [];
  }

  useVideo(): void {
    if (!this.chunks.length) return;
    const type = this.chunks[0]?.type || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File(this.chunks, `${Date.now()}_livevideo.${ext}`, { type });
    const preview = URL.createObjectURL(file);
    this.captured.emit({ file, preview, kind: 'video' });
    this.close();
  }

  formatTime(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
