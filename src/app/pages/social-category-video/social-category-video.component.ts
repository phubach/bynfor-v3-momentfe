import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MomentService } from '../../services/moment.service';
import { UserService } from '../../services/user.service';

/**
 * Trang duyệt video theo danh mục (gọn theo CategoryVideoComponent của customerfe):
 * ô tìm kiếm + dãy pill category + lưới video (hover xem trước) +
 * bấm mở chi tiết (qua lại prev/next) + cuộn vô hạn.
 */
@Component({
  selector: 'app-social-category-video',
  standalone: false,
  templateUrl: './social-category-video.component.html',
  styleUrls: ['./social-category-video.component.scss'],
})
export class SocialCategoryVideoComponent implements OnInit, OnDestroy {
  hasMore = true;
  private sequence = 0;
  private request?: Subscription;
  private query?: Subscription;
  videos: any[] = [];
  categories: any[] = [];
  categoryId?: string;
  keyword = '';
  hashTag = '';
  page = 1;
  pageSize = 18;
  loading = false;
  loadingMore = false;
  error = '';
  selected: any = null;
  selectedIndex = -1;
  private scrollHandler: any;

  constructor(private momentService: MomentService, private route: ActivatedRoute, private router: Router) {}

  goToProfile(user: any): void {
    const id = UserService.profileId(user);
    if (id) this.router.navigate(['/social/social-media-profile', id]);
  }

  ngOnInit(): void {
    this.loadCategories();
    this.query = this.route.queryParamMap.subscribe(params => {
      const tag = params.get('tag'); this.keyword = tag ? '#' + tag : ''; this.hashTag = this.keyword; this.loadVideos(true);
    });
    this.scrollHandler = () => {
      const nearBottom = window.innerHeight + window.scrollY + 1000 >= document.body.scrollHeight;
      if (nearBottom && this.videos.length && !this.loading && !this.loadingMore) this.loadVideos(false);
    };
    window.addEventListener('scroll', this.scrollHandler);
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe(); this.query?.unsubscribe(); this.sequence++;
    window.removeEventListener('scroll', this.scrollHandler);
  }

  loadCategories(): void {
    this.momentService.getVideoCategories().subscribe({
      next: (res: any) => {
        this.categories = res?.data || [];
      },
    });
  }

  loadVideos(reset = false): void {
    if (!reset && (!this.hasMore || this.loading || this.loadingMore)) return;
    if (reset) {
      this.request?.unsubscribe(); this.hasMore = true; this.loadingMore = false;
      this.page = 1;
      this.loading = true;
      this.error = '';
    } else {
      this.loadingMore = true;
    }
    const sequence = ++this.sequence;
    this.request = this.momentService.getNewVideos(this.page, this.pageSize, this.categoryId, this.keyword).subscribe({
      next: (res: any) => {
        if (sequence !== this.sequence) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        this.hasMore = list.length >= this.pageSize;
        this.videos = [...new Map((reset ? list : [...this.videos, ...list]).map(v => [v.id || v._id || v.attachmentUrl, v])).values()];
        this.page++;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => {
        if (sequence !== this.sequence) return;
        this.loading = false;
        this.loadingMore = false;
        this.error = 'social.loadFailed';
      },
    });
  }

  selectCategory(id?: string): void {
    this.categoryId = id;
    this.loadVideos(true);
  }

  search(): void {
    this.hashTag = '';
    this.loadVideos(true);
  }

  clearFilter(): void {
    this.keyword = '';
    this.hashTag = '';
    this.loadVideos(true);
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
    if (first) return (first.charAt(0) + (last ? last.charAt(0) : '')).toUpperCase();
    const full = (u.fullName || u.name || '').trim().replace(/\s+/g, ' ');
    if (full) {
      const parts = full.split(' ');
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return full.replace(/\s+/g, '').slice(0, 2).toUpperCase();
    }
    const name = (u.userName || '').trim();
    return name ? name.replace(/\s+/g, '').slice(0, 2).toUpperCase() : '?';
  }

  likeCount(v: any): number {
    return v?.momentLikes?.length || 0;
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
    if (v?.momentId) this.momentService.addVideoHistory(v.momentId).subscribe({ error: () => {} });
    if (v?.id && !v?.attachmentUrl) {
      this.momentService.getVideo(v.id).subscribe({
        next: (res: any) => {
          if (res?.data && this.selected === v) this.selected = { ...v, ...res.data };
        },
      });
    }
    if (!this.loadingMore && index + 6 >= this.videos.length) this.loadVideos(false);
  }

  closeDetail(): void {
    this.selected = null;
    this.selectedIndex = -1;
  }

  stepDetail(dir: 1 | -1): void {
    const next = this.selectedIndex + dir;
    if (next >= 0 && next < this.videos.length) this.openDetail(this.videos[next], next);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selected) this.closeDetail();
  }
}
