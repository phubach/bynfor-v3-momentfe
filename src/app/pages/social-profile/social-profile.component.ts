import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MomentService } from '../../services/moment.service';
import { UserService } from '../../services/user.service';
@Component({
  selector: 'app-social-profile',
  standalone: false,
  templateUrl: './social-profile.component.html',
  styleUrls: ['./social-profile.component.scss'],
})
export class SocialProfileComponent implements OnInit, OnDestroy {
  userId = '';
  user: any = null;
  countInfo: any = {};
  location = '';
  tab: 'ALL' | 'VIDEO' | 'TAG' = 'ALL';
  items: any[] = [];
  page = 1;
  pageSize = 18;
  loading = false;
  loadingMore = false;
  error = '';
  private sub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private momentService: MomentService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => {
      this.userId = params.get('id') || '';
      if (!this.userId) return;
      this.user = null;
      this.countInfo = {};
      this.loadHeader();
      this.switchTab('ALL');
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadHeader(): void {
    forkJoin({
      user: this.userService.getSelectedUser(this.userId).pipe(catchError(() => of(null))),
      counts: this.userService.getFollowCounts(this.userId).pipe(catchError(() => of(null))),
      moments: this.momentService.getCountMoments(this.userId).pipe(catchError(() => of(null))),
    }).subscribe((res: any) => {
      this.user = res.user?.data || res.user || null;
      const loc = this.user?.location || {};
      this.location = [loc.address1, loc.stateName, loc.city, loc.countryName].filter(Boolean).join(', ');
      this.countInfo = { ...(res.counts?.data || {}), momentCount: res.moments?.data };
    });
  }

  switchTab(tab: 'ALL' | 'VIDEO' | 'TAG'): void {
    this.tab = tab;
    this.page = 1;
    this.loading = true;
    this.error = '';
    this.momentService.getMediaFiles(this.page, this.pageSize, this.userId, tab === 'ALL' ? '' : tab).subscribe({
      next: (res: any) => {
        this.items = res?.data || [];
        this.page++;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'social.loadFailed';
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore) return;
    this.loadingMore = true;
    this.momentService.getMediaFiles(this.page, this.pageSize, this.userId, this.tab === 'ALL' ? '' : this.tab).subscribe({
      next: (res: any) => {
        this.items = [...this.items, ...(res?.data || [])];
        this.page++;
        this.loadingMore = false;
      },
      error: () => (this.loadingMore = false),
    });
  }

  fullName(): string {
    return [this.user?.firstName, this.user?.lastName].filter(Boolean).join(' ');
  }

  avatarUrl(): string {
    const url = (this.user?.profilePictureUrl || '').trim();
    return url && url !== 'null' && url !== 'https://via.placeholder.com/50' ? url : '';
  }

  avatarText(): string {
    const first = (this.user?.firstName || '').trim();
    const last = (this.user?.lastName || '').trim();
    const name = (this.user?.userName || '').trim();
    if (first) return (first.charAt(0) + (last ? last.charAt(0) : '')).toUpperCase();
    return name ? name.replace(/\s+/g, '').slice(0, 2).toUpperCase() : '';
  }

  isVideo(item: any): boolean {
    const type = (item?.attachmentType || item?.type || '').toUpperCase();
    if (type.includes('VIDEO')) return true;
    if (type.includes('IMAGE')) return false;
    return /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(item?.attachmentUrl || '');
  }
}
