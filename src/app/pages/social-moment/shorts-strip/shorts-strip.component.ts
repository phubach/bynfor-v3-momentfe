import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MomentService } from '../../../services/moment.service';

/**
 * Dải Shorts ngang trong feed moment (gọn theo sum-act-wall của customerfe):
 * video mới nhất, cuộn ngang, bấm mở popup chi tiết.
 */
@Component({
  selector: 'app-shorts-strip',
  standalone: false,
  templateUrl: './shorts-strip.component.html',
  styleUrls: ['./shorts-strip.component.scss'],
})
export class ShortsStripComponent implements OnInit {
  videos: any[] = [];
  loading = false;
  selected: any = null;
  selectedIndex = -1;
  @ViewChild('track', { static: false }) track?: ElementRef<HTMLDivElement>;

  constructor(private momentService: MomentService) {}

  ngOnInit(): void {
    this.loading = true;
    this.momentService.getNewVideos(1, 12).subscribe({
      next: (res: any) => {
        this.videos = res?.data || [];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  scrollBy(dir: 1 | -1): void {
    this.track?.nativeElement.scrollBy({ left: dir * 480, behavior: 'smooth' });
  }

  userName(v: any): string {
    const u = v?.userResponseMoment || {};
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
  }

  avatarUrl(v: any): string {
    const url = (v?.userResponseMoment?.profilePictureUrl || '').trim();
    return url && url !== 'null' ? url : '';
  }

  avatarText(v: any): string {
    const u = v?.userResponseMoment || {};
    const first = (u.firstName || '').trim();
    const last = (u.lastName || '').trim();
    const name = (u.userName || '').trim();
    if (first) return (first.charAt(0) + (last ? last.charAt(0) : '')).toUpperCase();
    return name ? name.replace(/\s+/g, '').slice(0, 2).toUpperCase() : '?';
  }

  likeCount(v: any): number {
    return v?.momentLikes?.length ?? v?.likeCount ?? 0;
  }

  previewPlay(el: HTMLVideoElement): void {
    try {
      el.currentTime = 0;
      const p = el.play();
      if (p !== undefined) p.catch(() => {});
    } catch {}
  }

  previewStop(el: HTMLVideoElement): void {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {}
  }

  openDetail(v: any, index: number): void {
    this.selected = v;
    this.selectedIndex = index;
    if (v?.momentId) this.momentService.addVideoHistory(v.momentId).subscribe();
    if (v?.id && !v?.attachmentUrl) {
      this.momentService.getVideo(v.id).subscribe({
        next: (res: any) => {
          if (res?.data) this.selected = { ...v, ...res.data };
        },
      });
    }
  }

  closeDetail(): void {
    this.selected = null;
    this.selectedIndex = -1;
  }

  stepDetail(dir: 1 | -1): void {
    const next = this.selectedIndex + dir;
    if (next >= 0 && next < this.videos.length) this.openDetail(this.videos[next], next);
  }
}
