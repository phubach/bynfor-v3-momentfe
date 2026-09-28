import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

/**
 * Player 1 video: loading spinner, error + retry, thanh seek (timeupdate/sliderChange gốc),
 * 1 chạm = play/pause, 2 chạm = like (likeHeart gốc). Không jQuery.
 */
@Component({
  selector: 'app-reel-player',
  standalone: false,
  templateUrl: './reel-player.component.html',
  styleUrls: ['./reel-player.component.scss'],
})
export class ReelPlayerComponent implements OnChanges {
  @Input() videoId = '';
  @Input() src = '';
  /** Ảnh preview hiện trong lúc loading (gốc: getVideoThumbnail/getImageFromVideo). */
  @Input() poster = '';
  @Input() muted = true;
  @Input() paused = false;
  @Input() loading = false;
  @Input() failed = false;
  @Input() currentTime = 0;
  @Input() duration = 0;
  @Input() showHeart = false;

  @Output() togglePlay = new EventEmitter<void>();
  @Output() doubleTap = new EventEmitter<void>();
  @Output() seek = new EventEmitter<number>();
  @Output() retry = new EventEmitter<void>();
  @Output() loaded = new EventEmitter<{ el: HTMLVideoElement }>();
  @Output() time = new EventEmitter<{ current: number; total: number }>();
  @Output() error = new EventEmitter<void>();

  private taps = 0;
  private tapTimer: any;
  posterFailed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] || changes['poster']) this.posterFailed = false;
  }

  onTap(): void {
    this.taps++;
    clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => {
      if (this.taps > 1) this.doubleTap.emit();
      else this.togglePlay.emit();
      this.taps = 0;
    }, 260);
  }

  onLoaded(el: HTMLVideoElement): void {
    this.loaded.emit({ el });
  }

  onTime(el: HTMLVideoElement): void {
    this.time.emit({ current: el.currentTime || 0, total: el.duration || 0 });
  }

  toClock(secs: number): string {
    secs = Math.max(0, Math.floor(Math.abs(secs || 0)));
    const h = Math.floor(secs / 3600);
    const m = Math.floor(secs / 60) % 60;
    const s = secs % 60;
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(s);
  }
}
