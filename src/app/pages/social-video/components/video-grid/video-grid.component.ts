import { Component, EventEmitter, Input, Output } from '@angular/core';
import { VideoCategory } from '../../social-video.model';

export type GridMode = 'browse' | 'history';

/**
 * Lưới duyệt video (gốc: category-video grid + video-history grid):
 * category filter, tìm kiếm từ khoá/hashtag/user, bấm vào xem reels tại video đó.
 * BE giữ nguyên: POST /new-videos (browse), GET /video-history (history).
 */
@Component({
  selector: 'app-video-grid',
  standalone: false,
  templateUrl: './video-grid.component.html',
  styleUrls: ['./video-grid.component.scss'],
})
export class VideoGridComponent {
  @Input() videos: any[] = [];
  @Input() loading = false;
  @Input() loadingMore = false;
  @Input() hasMore = false;
  @Input() categories: VideoCategory[] = [];
  @Input() activeCategory: string | null = null;
  @Input() keyword = '';
  @Input() mode: GridMode = 'browse';

  @Output() back = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<GridMode>();
  @Output() categoryChange = new EventEmitter<string | null>();
  @Output() search = new EventEmitter<string>();
  @Output() loadMore = new EventEmitter<void>();
  @Output() play = new EventEmitter<any>();

  draft = '';

  ngOnChanges(): void {
    this.draft = this.keyword || '';
  }

  thumb(v: any): string {
    const url = v?.attachmentUrl || '';
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&#/]+)/i);
    if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
    if (url && url.lastIndexOf('.') > url.lastIndexOf('/')) {
      return url.substring(0, url.lastIndexOf('.')) + '.webp';
    }
    return '';
  }

  title(v: any): string {
    const u = v?.userResponseMoment || {};
    return v?.description || u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
  }
}
