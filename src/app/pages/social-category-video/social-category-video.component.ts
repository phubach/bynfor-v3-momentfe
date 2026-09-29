import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
    const tag = this.route.snapshot.queryParamMap.get('tag');
    if (tag) {
      this.keyword = '#' + tag;
      this.hashTag = '#' + tag;
    }
    this.loadCategories();
    this.loadVideos(true);
    this.scrollHandler = () => {
      const nearBottom = window.innerHeight + window.scrollY + 1000 >= document.body.scrollHeight;
      if (nearBottom && this.videos.length && !this.loading && !this.loadingMore) this.loadVideos(false);
    };
    window.addEventListener('scroll', this.scrollHandler);
  }

  ngOnDestroy(): void {
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
    if (reset) {
      this.page = 1;
      this.loading = true;
      this.error = '';
    } else {
      this.loadingMore = true;
    }
    this.momentService.getNewVideos(this.page, this.pageSize, this.categoryId, this.keyword).subscribe({
      next: (res: any) => {
        const list = res?.data || [];
        this.videos = reset ? list : [...this.videos, ...list];
        this.page++;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => {
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
    if (v?.momentId) this.momentService.addVideoHistory(v.momentId).subscribe();
    if (v?.id && !v?.attachmentUrl) {
      this.momentService.getVideo(v.id).subscribe({
        next: (res: any) => {
          if (res?.data) this.selected = { ...v, ...res.data };
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
