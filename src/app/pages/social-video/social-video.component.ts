import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MomentService } from '../../services/moment.service';

@Component({
  selector: 'app-social-video',
  standalone: false,
  templateUrl: './social-video.component.html',
  styleUrls: ['./social-video.component.scss'],
})
export class SocialVideoComponent implements OnInit, OnDestroy {
  videos: any[] = [];
  selectedIndex = 0;
  isFollowing: 'FOR_YOU' | 'FOLLOWING' = 'FOR_YOU';
  page = 1;
  size = 6;
  isLoadingVideos = false;
  isLoadingMore = false;
  error = '';
  muted = true;
  paused = false;
  showComments = false;
  commentDraft = '';
  sendingComment = false;
  liking = false;

  private wheelLock = false;
  private wheelDelta = 0;
  private readonly wheelThreshold = 55;
  private readonly wheelCooldown = 420;
  private wheelTimer: any;
  private transitionTimer: any;
  private isSwitching = false;
  private touchStart = { y: 0, time: 0 };

  constructor(private momentService: MomentService) {}

  ngOnInit(): void {
    this.loadVideos(true);
  }

  ngOnDestroy(): void {
    clearTimeout(this.wheelTimer);
    clearTimeout(this.transitionTimer);
    this.pauseAll();
  }

  loadVideos(reset = false): void {
    if (reset) {
      this.page = 1;
      this.selectedIndex = 0;
      this.isLoadingVideos = true;
      this.error = '';
    } else {
      this.isLoadingMore = true;
    }
    this.momentService.getVideos(this.page, this.size, this.isFollowing === 'FOLLOWING').subscribe({
      next: (res: any) => {
        const list = (res?.data || []).map((v: any) => ({
          ...v,
          momentComments: v?.momentComments || v?.comments || [],
        }));
        this.videos = reset ? list : [...this.videos, ...list];
        this.page++;
        this.isLoadingVideos = false;
        this.isLoadingMore = false;
        this.showComments = false;
        this.playCurrent();
      },
      error: () => {
        this.isLoadingVideos = false;
        this.isLoadingMore = false;
        this.error = 'social.loadFailed';
      },
    });
  }

  switchTab(tab: 'FOR_YOU' | 'FOLLOWING'): void {
    if (this.isFollowing === tab) return;
    this.isFollowing = tab;
    this.pauseAll();
    this.loadVideos(true);
  }

  current(): any {
    return this.videos[this.selectedIndex];
  }

  videoId(v: any, index: number): string {
    return `reel-video-${v?.id || v?.momentId || index}`;
  }

  inWindow(index: number): boolean {
    return Math.abs(index - this.selectedIndex) <= 2;
  }

  onWheel(e: WheelEvent): void {
    if (!this.videos.length || this.showComments) return;
    const target = e.target as HTMLElement;
    if (target?.closest('.comment-drawer') || target?.closest('input, textarea')) return;
    e.preventDefault();
    if (this.wheelLock) return;
    this.wheelDelta += e.deltaY;
    if (Math.abs(this.wheelDelta) < this.wheelThreshold) return;
    const down = this.wheelDelta > 0;
    this.wheelDelta = 0;
    if (down) this.nextVideo();
    else this.prevVideo();
    this.wheelLock = true;
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => (this.wheelLock = false), this.wheelCooldown);
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    const t = e.touches[0];
    this.touchStart = { y: t.pageY, time: e.timeStamp };
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent): void {
    const t = e.changedTouches[0];
    const dy = t.pageY - this.touchStart.y;
    const dt = e.timeStamp - this.touchStart.time;
    if (dt < 500 && Math.abs(dy) > 60 && !this.showComments) {
      if (dy > 0) this.prevVideo();
      else this.nextVideo();
    }
  }

  nextVideo(): void {
    if (this.selectedIndex < this.videos.length - 1 && !this.isSwitching) {
      this.isSwitching = true;
      this.selectedIndex++;
      this.afterSwitch();
    }
  }

  prevVideo(): void {
    if (this.selectedIndex > 0 && !this.isSwitching) {
      this.isSwitching = true;
      this.selectedIndex--;
      this.afterSwitch();
    }
  }

  private afterSwitch(): void {
    this.showComments = false;
    this.paused = false;
    this.playCurrent();
    clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => (this.isSwitching = false), 320);
  }

  private pauseAll(): void {
    document.querySelectorAll('.reel-item video').forEach((el) => (el as HTMLVideoElement).pause());
  }

  private playCurrent(): void {
    this.pauseAll();
    const v = this.current();
    if (!v) return;
    setTimeout(() => {
      const el = document.getElementById(this.videoId(v, this.selectedIndex)) as HTMLVideoElement;
      if (!el) return;
      el.muted = this.muted;
      el.currentTime = 0;
      if (!this.paused) {
        try {
          const p = el.play();
          if (p !== undefined) p.catch(() => {});
        } catch {}
      }
    }, 0);
    if (v.momentId) this.momentService.addVideoHistory(v.momentId).subscribe();
    if (!this.isLoadingMore && this.selectedIndex >= this.videos.length - 3) this.loadVideos(false);
  }

  togglePlay(): void {
    const v = this.current();
    if (!v) return;
    const el = document.getElementById(this.videoId(v, this.selectedIndex)) as HTMLVideoElement;
    if (!el) return;
    if (el.paused) {
      el.muted = this.muted;
      try {
        const p = el.play();
        if (p !== undefined) p.catch(() => {});
      } catch {}
      this.paused = false;
    } else {
      el.pause();
      this.paused = true;
    }
  }

  toggleMute(e: Event): void {
    e.stopPropagation();
    this.muted = !this.muted;
    const v = this.current();
    const el = v && (document.getElementById(this.videoId(v, this.selectedIndex)) as HTMLVideoElement);
    if (el) {
      el.muted = this.muted;
      if (el.paused && !this.muted) {
        this.paused = false;
        try {
          const p = el.play();
          if (p !== undefined) p.catch(() => {});
        } catch {}
      }
    }
  }

  likeCount(v: any): number {
    return v?.momentLikes?.length || 0;
  }

  commentList(v: any): any[] {
    return v?.momentComments || [];
  }

  toggleLike(e: Event): void {
    e.stopPropagation();
    const v = this.current();
    if (!v?.momentId || this.liking) return;
    const operation = v.likedByMe ? 'REMOVE' : 'ADD';
    this.liking = true;
    this.momentService.express(v.momentId, operation as any, 'LIKE', operation === 'ADD' ? '💖' : '').subscribe({
      next: (res: any) => {
        const updated = res?.data || {};
        if (updated.expressions) v.momentLikes = updated.expressions;
        v.likedByMe = operation === 'ADD';
        this.liking = false;
      },
      error: () => (this.liking = false),
    });
  }

  openComments(e: Event): void {
    e.stopPropagation();
    this.showComments = true;
  }

  closeComments(): void {
    this.showComments = false;
  }

  sendComment(): void {
    const v = this.current();
    const text = (this.commentDraft || '').trim();
    if (!v?.momentId || !text || this.sendingComment) return;
    this.sendingComment = true;
    this.momentService.addComment(v.momentId, text).subscribe({
      next: (res: any) => {
        const posted = res?.data || { comment: text, commentedAt: new Date().toISOString() };
        v.momentComments = [...(v.momentComments || []), posted];
        this.commentDraft = '';
        this.sendingComment = false;
      },
      error: () => (this.sendingComment = false),
    });
  }

  userName(v: any): string {
    const u = v?.userResponseMoment || {};
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
  }
}
