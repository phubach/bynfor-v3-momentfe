import { Component, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { I18NEXT_SERVICE, ITranslationService } from 'angular-i18next';
import { switchMap } from 'rxjs';
import { MomentService } from '../../services/moment.service';
import { RelationsService } from '../../services/relations.service';
import { UserService } from '../../services/user.service';
import { ERelationStatus, ReelComment, ReelVideo, VideoTab } from './social-video.model';

declare let alertify: any;

@Component({
  selector: 'app-social-video',
  standalone: false,
  templateUrl: './social-video.component.html',
  styleUrls: ['./social-video.component.scss'],
})
export class SocialVideoComponent implements OnInit, OnDestroy {
  tab: VideoTab = 'FOR_YOU';
  categoryId: string | null = null;
  categories: Array<{ _id: string; name: string; icon?: string }> = [];

  videos: ReelVideo[] = [];
  selectedIndex = 0;
  pageVideos = 1;
  readonly sizeVideos = 6;
  viewed = false;
  /** Gốc: isPageFollow — FOLLOWING trang 1 rỗng thì load nội dung For You đè lên tab Following. */
  isPageFollow = false;
  isLoadingVideos = false;
  loadingFirst = false;
  error = '';

  muted = true;
  paused = false;
  showHeart = false;
  loadMap: Record<number, boolean> = {};
  timeMap: Record<number, number> = {};
  durMap: Record<number, number> = {};

  creator: any = null;
  isCreatorFollowed = false;
  followBusy = false;

  friends: any[] = [];
  loadingFriends = false;
  friendsError = '';
  private friendsRequestId = 0;

  // ---------- Modal "People who you may know" (gốc: getPeople/noShowPeople/#idModalPeople) ----------
  suggestPeople: any[] = [];
  pagePeople = 1;
  readonly sizePeople = 24;
  loadingPeople = false;
  showPeopleModal = false;

  showComments = false;
  commentDraft = '';
  sendingComment = false;
  replyTo: ReelComment | null = null;
  editingId: string | null = null;
  myUserId: number | string | null = null;

  showFeedback = false;
  reportInfo: any = null;
  savedVideoReport: any = null;
  showReport = false;
  reportBusy = false;
  showShare = false;
  showLikes = false;
  likeUsers: any[] = [];
  loadingLikes = false;
  likeTab = 'All';
  pageLike = 1;
  readonly pageSizeLike = 10;
  totalLikes = 0;
  likeExprMap: Record<string, string> = {};
  likeCommentedIds: Record<string, boolean> = {};
  showDescription = false;

  // ---------- Modal profile creator (gốc: #idModalMemberProfile + showModalProfile) ----------
  showProfile = false;
  profileLoading = false;
  memberProfile: any = null;
  relationUser: any = null;

  // ---------- Lưới duyệt video (gốc: category-video grid + video-history grid) ----------
  showGrid = false;
  gridMode: 'browse' | 'history' = 'browse';
  gridVideos: any[] = [];
  gridPage = 1;
  readonly gridSize = 18;
  gridLoading = false;
  gridLoadingMore = false;
  gridHasMore = false;
  gridKeyword = '';
  gridCategory: string | null = null;

  // ---------- Gợi ý hashtag khi gõ comment (gốc: onSearchHashTag) ----------
  hashTags: Array<{ name: string; count?: number }> = [];
  private hashTagTimer: any;

  private switching = false;
  private wheelLock = false;
  private wheelDelta = 0;
  private timers: any[] = [];
  private requestId = 0;
  private touchStart = { y: 0, time: 0 };

  constructor(
    private momentService: MomentService,
    private relations: RelationsService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(I18NEXT_SERVICE) private i18n: ITranslationService,
  ) {}

  ngOnInit(): void {
    // Momentfe không lưu profile local như customerfe -> lấy user hiện tại từ BE.
    // (Trước đây đọc localStorage 'bynfor_profile' luôn ra null, làm isEndorsed/isLiked
    // và các check "chính mình" sai -> endorse cứ gửi ADD trùng -> BE từ chối -> tụt số.)
    try {
      const raw = localStorage.getItem('bynfor_profile');
      this.myUserId = raw ? JSON.parse(raw)?.id ?? null : null;
    } catch { this.myUserId = null; }
    // The shell normally loads the profile for the header. Load it here too so a
    // direct refresh on /social/video cannot skip auth/user before the shell is ready.
    this.userService.getCurrentUser().subscribe({
      next: (me: any) => {
        if (me?.id != null || me?.userId != null) this.myUserId = me.id ?? me.userId;
      },
      error: () => {},
    });
    this.getVideoCategories();
    this.getSuggestPeople(true);
    // Gốc: video-friend khởi tạo cùng trang nên gọi API ngay từ đầu.
    // Prefetch để tab Friend mở là có dữ liệu, không phụ thuộc lần bấm đầu.
    this.getFriends();
    const vid = this.route.snapshot.queryParams['videoId'];
    if (vid) this.openVideoById(vid);
    else this.getVideos();
    const tag = this.route.snapshot.queryParams['tag'];
    if (tag) this.openGrid('browse', '#' + String(tag).replace(/^#/, ''));
  }

  ngOnDestroy(): void {
    this.timers.forEach((t) => clearTimeout(t));
    clearTimeout(this.hashTagTimer);
    this.requestId++;
    this.friendsRequestId++;
    this.pauseAll();
  }

  // ---------- Category (gốc: getVideoCategories/selectCategory) ----------
  getVideoCategories(): void {
    this.momentService.getVideoCategories().subscribe({
      next: (res: any) => (this.categories = res?.data || []),
      error: () => (this.categories = []),
    });
  }

  selectCategory(id: string | null): void {
    this.categoryId = id;
    this.viewed = false;
    this.showGrid = false;
    this.getVideos();
  }

  backToMoment(): void {
    this.router.navigate(['/social/moment']);
  }

  // ---------- Tabs (gốc: getVideoFollowing) ----------
  switchTab(tab: VideoTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.requestId++;
    this.showGrid = false;
    this.loadingFirst = false;
    this.isLoadingVideos = false;
    this.viewed = false;
    if (tab === 'FRIEND') {
      this.pauseAll();
      this.getFriends();
      return;
    }
    this.getVideos();
  }

  // ---------- Feed: giữ tab đã chọn; FOLLOWING rỗng thì fallback For You (gốc: isPageFollow). ----------
  getVideos(isUpdate = false): void {
    const req = ++this.requestId;
    const wantCategory = this.categoryId;
    const wantTab = this.tab;
    // Gốc: rời tab FOLLOWING thì reset cờ fallback.
    if (wantTab !== 'FOLLOWING') this.isPageFollow = false;
    if (!isUpdate) {
      this.pageVideos = 1;
      this.selectedIndex = 0;
      this.videos = [];
      this.error = '';
      this.loadingFirst = true;
      this.showComments = false;
    }
    this.isLoadingVideos = true;
    const following = wantTab === 'FOLLOWING';
    // Gốc: param isFollowing = (tab FOLLOWING && !isPageFollow).
    const effectiveFollowing = following && !this.isPageFollow;
    this.momentService
      .getVideos(this.pageVideos, this.sizeVideos, effectiveFollowing, wantCategory, '', null, this.viewed)
      .subscribe({
        next: (res: any) => {
          if (req !== this.requestId || wantCategory !== this.categoryId || wantTab !== this.tab) return;
          if (!this.validVideoResponse(res)) {
            this.isLoadingVideos = false;
            this.loadingFirst = false;
            this.error = 'social.loadFailed';
            return;
          }
          const list: ReelVideo[] = res.data.map((v: any) => ({
            ...v,
            momentComments: [...(v?.momentComments || v?.comments || [])].sort(this.byCreated),
          }));
          // Gốc (tiktok getVideos): FOLLOWING trang 1 rỗng -> isPageFollow=true,
          // gọi lại lấy nội dung For You đè lên tab Following (tab vẫn giữ Following).
          if (wantTab === 'FOLLOWING' && !isUpdate && !this.isPageFollow && this.pageVideos === 1 && !list.length) {
            this.isPageFollow = true;
            this.getVideos();
            return;
          }
          if (!this.viewed && list.length < this.sizeVideos) {
            this.viewed = true;
            const retryFollowing = following && !this.isPageFollow;
            this.momentService
              .getVideos(this.pageVideos, this.sizeVideos, retryFollowing, wantCategory, '', null, true)
              .subscribe({
                next: (r2: any) => {
                  if (req !== this.requestId) return;
                  if (!this.validVideoResponse(r2)) {
                    this.applyVideos(list, isUpdate);
                    if (!list.length) this.error = 'social.loadFailed';
                    return;
                  }
                  const extra: ReelVideo[] = r2.data.map((v: any) => ({
                    ...v,
                    momentComments: [...(v?.momentComments || [])].sort(this.byCreated),
                  }));
                  this.applyVideos(list.concat(extra), isUpdate);
                },
                error: () => {
                  if (req !== this.requestId) return;
                  this.applyVideos(list, isUpdate);
                  if (!list.length) this.error = 'social.loadFailed';
                },
              });
            return;
          }
          this.applyVideos(list, isUpdate);
        },
        error: () => {
          if (req !== this.requestId) return;
          this.isLoadingVideos = false;
          this.loadingFirst = false;
          this.error = 'social.loadFailed';
        },
      });
  }

  private validVideoResponse(response: any): boolean {
    return (response?.status == null || Number(response.status) === 200) && Array.isArray(response?.data);
  }

  private applyVideos(list: ReelVideo[], isUpdate: boolean): void {
    const combined = isUpdate ? [...this.videos, ...list] : list;
    const seen = new Set<string>();
    this.videos = combined.filter(video => !seen.has(video.id) && !!seen.add(video.id));
    this.pageVideos++;
    this.isLoadingVideos = false;
    this.loadingFirst = false;
    if (!isUpdate) this.afterSelect();
  }

  private openVideoById(id: string): void {
    const req = ++this.requestId;
    this.isLoadingVideos = false;
    this.loadingFirst = true;
    this.error = '';
    this.momentService.getVideo(id).subscribe({
      next: (res: any) => {
        if (req !== this.requestId) return;
        this.loadingFirst = false;
        const v = res?.data;
        if (!v) { this.error = 'social.loadFailed'; return; }
        this.videos = this.videos.filter((x) => x.id !== v.id);
        this.videos.unshift({ ...v, momentComments: [...(v?.momentComments || [])].sort(this.byCreated) });
        this.selectedIndex = 0;
        this.afterSelect();
      },
      error: () => {
        if (req !== this.requestId) return;
        this.loadingFirst = false;
        this.error = 'social.loadFailed';
      },
    });
  }

  current(): ReelVideo | null {
    return this.videos[this.selectedIndex] || null;
  }

  videoDomId(v: ReelVideo, i: number): string {
    return `reel-video-${v?.id || v?.momentId || i}`;
  }

  // ---------- Điều hướng reels (gốc: upVideo/downVideo/newPlay/wheel/touch) ----------
  nextVideo(): void {
    if (this.selectedIndex < this.videos.length - 1 && !this.switching) {
      this.selectedIndex++;
      this.switching = true;
      this.afterSelect();
      this.timers.push(setTimeout(() => (this.switching = false), 320));
    }
  }

  prevVideo(): void {
    if (this.selectedIndex > 0 && !this.switching) {
      this.selectedIndex--;
      this.switching = true;
      this.afterSelect();
      this.timers.push(setTimeout(() => (this.switching = false), 320));
    }
  }

  onWheel(e: WheelEvent): void {
    if (!this.videos.length || this.overlayOpen() || this.tab === 'FRIEND') return;
    const t = e.target as HTMLElement;
    if (t?.closest('.sheet, .overlay, input, textarea')) return;
    e.preventDefault();
    if (this.wheelLock) return;
    this.wheelDelta += e.deltaY;
    if (Math.abs(this.wheelDelta) < 55) return;
    const down = this.wheelDelta > 0;
    this.wheelDelta = 0;
    if (down) this.nextVideo();
    else this.prevVideo();
    this.wheelLock = true;
    this.timers.push(setTimeout(() => (this.wheelLock = false), 420));
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
    if (dt < 500 && Math.abs(dy) > 60 && !this.overlayOpen() && this.tab !== 'FRIEND') {
      if (dy > 0) this.prevVideo();
      else this.nextVideo();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!this.overlayOpen() && this.tab !== 'FRIEND' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (e.key === 'ArrowDown') this.nextVideo();
      else this.prevVideo();
    }
    if (e.key === 'Escape') {
      this.showComments = false;
      this.showFeedback = false;
      this.showReport = false;
      this.showShare = false;
      this.showLikes = false;
      this.showDescription = false;
      this.showProfile = false;
    }
  }

  private overlayOpen(): boolean {
    return this.showFeedback || this.showGrid || this.showComments || this.showReport || this.showShare
      || this.showLikes || this.showDescription || this.showProfile || this.showPeopleModal;
  }

  private afterSelect(): void {
    this.showComments = false;
    this.replyTo = null;
    this.editingId = null;
    this.paused = false;
    this.loadMap[this.selectedIndex] = true;
    const v = this.current();
    this.creator = v?.userResponseMoment || null;
    this.syncCreatorFollow();
    this.playCurrent();
  }

  private pauseAll(): void {
    document.querySelectorAll('.reel-stage video').forEach((el) => (el as HTMLVideoElement).pause());
  }

  private playCurrent(): void {
    this.pauseAll();
    const v = this.current();
    if (!v) return;
    setTimeout(() => {
      const el = document.getElementById(this.videoDomId(v, this.selectedIndex)) as HTMLVideoElement;
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
    if (v.momentId) this.momentService.addVideoHistory(v.momentId).subscribe({ next: () => {}, error: () => {} });
    if (!this.isLoadingVideos && this.selectedIndex >= this.videos.length - 3) this.getVideos(true);
  }

  // ---------- Player events ----------
  togglePlay(): void {
    const v = this.current();
    if (!v) return;
    const el = document.getElementById(this.videoDomId(v, this.selectedIndex)) as HTMLVideoElement;
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

  toggleMute(): void {
    this.muted = !this.muted;
    const v = this.current();
    const el = v && (document.getElementById(this.videoDomId(v, this.selectedIndex)) as HTMLVideoElement);
    if (el) el.muted = this.muted;
    this.showToast(
      this.muted ? this.tr('social.muted', 'Muted.') : this.tr('social.unmuted', 'Sound on.'),
      'info',
    );
  }

  onLoaded(i: number): void {
    this.loadMap[i] = false;
  }

  onTime(i: number, e: { current: number; total: number }): void {
    this.timeMap[i] = e.current;
    this.durMap[i] = e.total;
  }

  onVideoError(i: number): void {
    const v = this.videos[i];
    if (v) v.error = true;
    this.loadMap[i] = false;
  }

  retry(i: number): void {
    const v = this.videos[i];
    if (!v) return;
    v.error = false;
    this.loadMap[i] = true;
    setTimeout(() => {
      const el = document.getElementById(this.videoDomId(v, i)) as HTMLVideoElement;
      if (el) {
        el.load();
        el.muted = this.muted;
        try {
          const p = el.play();
          if (p !== undefined) p.catch(() => {});
        } catch {}
      }
    }, 0);
  }

  seekTo(i: number, pct: number): void {
    const v = this.videos[i];
    if (!v || !this.durMap[i]) return;
    const el = document.getElementById(this.videoDomId(v, i)) as HTMLVideoElement;
    if (el) el.currentTime = (Number(pct) * this.durMap[i]) / 100;
  }

  // ---------- Like / double-tap (gốc: like + likeHeart) ----------
  isLiked(v: ReelVideo | null): boolean {
    if (!v) return false;
    if (v.likedByMe != null) return v.likedByMe;
    return (v.momentLikes || []).some((e) => String(e.expressedBy) === String(this.myUserId));
  }

  likeCount(v: ReelVideo | null): number {
    return v?.momentLikes?.length || 0;
  }

  toggleLike(): void {
    const v = this.current();
    if (!v?.momentId) return;
    const operation = this.isLiked(v) ? 'REMOVE' : 'ADD';
    // Optimistic update (logic gốc).
    if (operation === 'ADD') {
      v.momentLikes = [...(v.momentLikes || []), { expressedBy: this.myUserId as any, expressedContent: '💖', expression: 'LIKE' }];
    } else {
      v.momentLikes = (v.momentLikes || []).filter((e) => String(e.expressedBy) !== String(this.myUserId));
    }
    v.likedByMe = operation === 'ADD';
    this.momentService.express(v.momentId, operation as any, 'LIKE', operation === 'ADD' ? '💖' : '').subscribe({
      next: (res: any) => {
        if (res?.data?.expressions) v.momentLikes = res.data.expressions;
        v.likedByMe = operation === 'ADD';
        this.showToast(
          operation === 'ADD'
            ? this.tr('toastr.success.product_liked', 'You liked this video.')
            : this.tr('toastr.success.product_unliked', 'You unliked this video.'),
          operation === 'ADD' ? 'success' : 'info',
        );
      },
      error: (err: any) => {
        v.likedByMe = operation !== 'ADD';
        this.refreshLikes(v);
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  doubleTapLike(): void {
    const v = this.current();
    if (!v || this.isLiked(v)) {
      if (v) this.burstHeart();
      return;
    }
    this.burstHeart();
    this.toggleLike();
  }

  private burstHeart(): void {
    this.showHeart = true;
    this.timers.push(setTimeout(() => (this.showHeart = false), 900));
  }

  private refreshLikes(v: ReelVideo): void {
    this.momentService.getVideo(v.id).subscribe({
      next: (res: any) => {
        v.momentLikes = res?.data?.momentLikes || v.momentLikes;
        v.likedByMe = (v.momentLikes || []).some((e) => String(e.expressedBy) === String(this.myUserId));
      },
      error: () => {},
    });
  }

  // ---------- Modal likes (gốc: handleViewLikeDislike + #idModalLikeAndDislike) ----------
  private likeTabToContent(tab: string): string {
    const map: Record<string, string> = {
      '+1': '👍',
      heart: '💖',
      eyes: '😍',
      grin: '😀',
      scream: '😱',
      sob: '😭',
      rage: '😡',
    };
    return map[tab] || '';
  }

  openLikeList(): void {
    this.likeTab = 'All';
    this.pageLike = 1;
    this.fetchLikes();
  }

  likeTabChange(tab: string): void {
    this.likeTab = tab;
    this.pageLike = 1;
    this.fetchLikes();
  }

  likePageChange(page: number): void {
    this.pageLike = page;
    this.fetchLikes();
  }

  private fetchLikes(): void {
    const v = this.current();
    if (!v?.momentId) return;
    this.showLikes = true;
    this.loadingLikes = true;
    this.likeUsers = [];
    // Map expression + commenter để hiện cạnh tên (gốc: expressionsMap/commentMap).
    this.likeExprMap = {};
    (v.momentLikes || []).forEach((e: any) => {
      this.likeExprMap[String(e.expressedBy)] = e.expressedContent || '👍';
    });
    this.likeCommentedIds = {};
    (v.momentComments || []).forEach((c) => {
      const id = c.from ?? c.createdBy ?? (c.createdByFull as any)?.id;
      if (id != null) this.likeCommentedIds[String(id)] = true;
    });
    this.momentService
      .getCustomerLikeOrDisLike(v.momentId, this.pageLike, this.pageSizeLike, 'LIKE', this.likeTabToContent(this.likeTab))
      .subscribe({
        next: (res: any) => {
          let list = res?.data?.list || [];
          if (this.likeTab === 'Comment') list = list.filter((u: any) => this.likeCommentedIds[String(u.id)]);
          this.likeUsers = list;
          this.totalLikes = res?.data?.paging?.totalRows ?? list.length;
          this.loadingLikes = false;
        },
        error: () => (this.loadingLikes = false),
      });
  }

  likeAddFriend(u: any): void {
    this.relations.addToFriends(u.id).subscribe({
      next: () => {
        u.relation = ERelationStatus.FRIEND_REQUEST;
        this.showToast(this.tr('toastr.success.friend_request_sent', 'Friend request sent successfully.'), 'success');
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  likeCancelFriend(u: any): void {
    if (this.myUserId == null) return;
    this.relations.removeFromFriends(u.id, this.myUserId as any).subscribe({
      next: () => {
        u.relation = ERelationStatus.UNFOLLOWED;
        this.showToast(
          this.tr('toastr.success.friend_removed', '{{userName}} was successfully removed from your friend list.', {
            userName: this.personName(u) || 'User',
          }),
          'success',
        );
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  likeFollow(u: any): void {
    this.relations.followSeller(u.id).subscribe({
      next: () => {
        u.relation =
          u.relation === ERelationStatus.FRIEND ? ERelationStatus.FRIEND_AND_FOLLOW : ERelationStatus.FOLLOW;
        this.showToast(
          this.tr('toastr.success.you_are_following', 'You followed {{name}}', { name: this.personName(u) || 'user' }),
          'success',
        );
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  likeUnfollow(u: any): void {
    this.relations.unfollowSeller(u.id).subscribe({
      next: () => {
        u.relation =
          u.relation === ERelationStatus.FRIEND_AND_FOLLOW ? ERelationStatus.FRIEND : ERelationStatus.UNFOLLOWED;
        this.showToast(
          this.tr('toastr.success.you_are_not_following', 'You unfollowed {{name}}', { name: this.personName(u) || 'user' }),
          'success',
        );
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  // ---------- Endorse (gốc: endorseClick, optimistic + rollback + báo lỗi) ----------
  private endorserId(e: any): any {
    return e?.userId ?? e?.expressedBy;
  }

  isEndorsed(v: ReelVideo | null): boolean {
    return !!v && (v.endorsements || []).some((e) => String(this.endorserId(e)) === String(this.myUserId));
  }

  endorseCount(v: ReelVideo | null): number {
    if (!v) return 0;
    return v.endorsementCount != null ? v.endorsementCount : (v.endorsements || []).length;
  }

  endorse(): void {
    const v = this.current();
    // Gốc: '/endorse-moment/' + (m._id || m.momentId) — giữ y hệt, không chỉ dùng momentId.
    const targetId = (v as any)?._id || v?.momentId;
    if (!v || !targetId) return;
    const operation = this.isEndorsed(v) ? 'REMOVE' : 'ADD';
    const prev = [...(v.endorsements || [])];
    const prevCount = this.endorseCount(v);
    if (operation === 'ADD') {
      v.endorsements = [...prev, { userId: this.myUserId as any } as any];
      v.endorsementCount = prevCount + 1;
    } else {
      v.endorsements = prev.filter((e) => String(this.endorserId(e)) !== String(this.myUserId));
      v.endorsementCount = Math.max(0, prevCount - 1);
    }
    this.momentService.endorse(targetId, operation as any).subscribe({
      next: (res: any) => {
        if (res?.data) {
          v.endorsements = res.data.endorsements || v.endorsements;
          v.endorsementCount = res.data.endorsementCount ?? this.endorseCount(v);
        }
        this.showToast(
          operation === 'ADD'
            ? this.tr('toastr.success.endorsed', 'Endorsed with credit.')
            : this.tr('toastr.success.endorse_removed', 'Endorsement removed.'),
          operation === 'ADD' ? 'success' : 'info',
        );
      },
      error: (err: any) => {
        v.endorsements = prev;
        v.endorsementCount = prevCount;
        // Gốc hiện alertService.errorTop — bản mới toast để không fail trong im lặng.
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  // ---------- Toast (thay alertService/toastr của gốc, dùng chung i18n keys) ----------
  toast = '';
  toastKind: 'success' | 'error' | 'info' = 'info';

  showToast(msg: string, kind: 'success' | 'error' | 'info' = 'info'): void {
    this.toast = msg;
    this.toastKind = kind;
    this.timers.push(
      setTimeout(() => {
        this.toast = '';
      }, 5000),
    );
  }

  /** Dịch key i18n, rớt về text EN khi thiếu key (giống alertService gốc). */
  private tr(key: string, fallback: string, params?: any): string {
    try {
      const v = this.i18n.t(key, params as any);
      return typeof v === 'string' && v !== key ? v : this.fill(fallback, params);
    } catch {
      return this.fill(fallback, params);
    }
  }

  private fill(template: string, params?: any): string {
    let out = template;
    Object.keys(params || {}).forEach((k) => {
      out = out.split('{{' + k + '}}').join(String((params as any)[k] ?? ''));
    });
    return out;
  }

  /** Message lỗi BE (gốc: error.error.message + request_failed fallback). */
  private errMsg(err: any, fallbackKey = 'toastr.error.request_failed', fallbackText = 'Request failed.'): string {
    const server = err?.error?.message;
    if (typeof server === 'string' && server.trim()) {
      if (server.includes('You have collect monetary gift as the follower')) {
        return this.tr(
          'you_have_collect_monetary_gift_as_the_follower_or_friend',
          'You have collected a monetary gift as a follower/friend and cannot unfollow.',
        );
      }
      return server;
    }
    return this.tr(fallbackKey, fallbackText);
  }

  private personName(u: any): string {
    return (u?.firstName && u?.lastName ? u.firstName + ' ' + u.lastName : u?.userName) || '';
  }

  // ---------- Follow / friend creator (gốc: follow/unfollow/syncCreatorFollowState) ----------
  private syncCreatorFollow(): void {
    this.isCreatorFollowed = false;
    const creatorId = this.creator?.id;
    if (!creatorId || String(creatorId) === String(this.myUserId)) return;
    this.relations.getCustomerRelation(creatorId).subscribe({
      next: (res: any) => {
        const st = res?.data?.status;
        this.isCreatorFollowed = st === 'FOLLOW' || st === 'FRIEND_AND_FOLLOW' || st === 'FRIEND_AND_FOLLOW_REQUEST';
      },
      error: () => (this.isCreatorFollowed = false),
    });
  }

  followCreator(): void {
    if (!this.creator?.id || this.followBusy) return;
    this.followBusy = true;
    this.relations.followSeller(this.creator.id).subscribe({
      next: () => {
        this.isCreatorFollowed = true;
        this.followBusy = false;
        this.showToast(
          this.tr('toastr.success.you_are_following', 'You followed {{name}}', {
            name: this.personName(this.creator) || 'user',
          }),
          'success',
        );
      },
      error: (err: any) => {
        this.followBusy = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  unfollowCreator(): void {
    if (!this.creator?.id || this.followBusy) return;
    this.followBusy = true;
    this.relations.unfollowSeller(this.creator.id).subscribe({
      next: () => {
        this.isCreatorFollowed = false;
        this.followBusy = false;
        this.showToast(
          this.tr('toastr.success.you_are_not_following', 'You unfollowed {{name}}', {
            name: this.personName(this.creator) || 'user',
          }),
          'success',
        );
      },
      error: (err: any) => {
        this.followBusy = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  // ---------- Friend pane (gốc: video-friend) ----------
  getFriends(): void {
    const requestId = ++this.friendsRequestId;
    this.loadingFriends = true;
    this.friendsError = '';
    this.relations.getFriendsWithFollowing().subscribe({
      next: (res: any) => {
        if (requestId !== this.friendsRequestId) return;
        // The original friends-new endpoint returns { data: UserLimitedInfoResponse[] }.
        const data = res?.data;
        const list = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : null;
        if ((res?.status != null && Number(res.status) !== 200) || !list) {
          this.friends = [];
          this.friendsError = 'social.loadFailed';
        } else {
          this.friends = list.map((friend: any) => ({
            ...friend,
            following: friend.following === true || friend.following === 'true',
          }));
        }
        this.loadingFriends = false;
      },
      error: () => {
        if (requestId !== this.friendsRequestId) return;
        this.friends = [];
        this.friendsError = 'social.loadFailed';
        this.loadingFriends = false;
      },
    });
  }

  followFriend(f: any): void {
    this.setFriendFollowing(f, true);
  }

  unfollowFriend(f: any): void {
    this.setFriendFollowing(f, false);
  }

  private setFriendFollowing(friend: any, following: boolean): void {
    if (friend.followBusy || friend.id == null) return;
    friend.followBusy = true;
    friend.actionError = '';
    const request = following
      ? this.relations.followSeller(friend.id)
      : this.relations.unfollowSeller(friend.id);
    request.subscribe({
      next: (res: any) => {
        friend.followBusy = false;
        if (res?.status != null && Number(res.status) !== 200) {
          const msg = res?.message || 'toastr.error.request_failed';
          friend.actionError = msg;
          this.showToast(this.tr(msg, 'Request failed.'), 'error');
          return;
        }
        friend.following = following;
        // Gốc video-friend: success you_are_following / you_are_not_following + tên.
        this.showToast(
          following
            ? this.tr('toastr.success.you_are_following', 'You followed {{name}}', { name: this.personName(friend) || 'user' })
            : this.tr('toastr.success.you_are_not_following', 'You unfollowed {{name}}', { name: this.personName(friend) || 'user' }),
          'success',
        );
      },
      error: (error: any) => {
        friend.followBusy = false;
        const message = error?.error?.message;
        friend.actionError = this.errMsg(error);
        this.showToast(friend.actionError, 'error');
      },
    });
  }

  // ---------- "People who you may know" (gốc: getPeople/hideModalPeople/noShowPeople) ----------
  private peopleDismissed(): boolean {
    if (localStorage.getItem('sv_hide_people') === '1') return true;
    try {
      return !!JSON.parse(localStorage.getItem('bynfor_profile') || '{}')?.noShowPeople;
    } catch { return false; }
  }

  getSuggestPeople(first = false): void {
    if (this.peopleDismissed()) return;
    if (this.loadingPeople) return;
    if (!first) this.pagePeople++;
    this.loadingPeople = true;
    this.userService.getPeople(this.pagePeople, this.sizePeople).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res?.data) ? res.data : res?.data?.list || [];
        this.suggestPeople.push(...list);
        this.loadingPeople = false;
        if (first) this.showPeopleModal = true;
      },
      error: () => (this.loadingPeople = false),
    });
  }

  hidePeopleModal(): void {
    this.showPeopleModal = false;
  }

  doNotShowPeopleAgain(): void {
    this.showPeopleModal = false;
    localStorage.setItem('sv_hide_people', '1');
    this.userService.noShowPeople({ noShowPeople: true }).subscribe({ next: () => {}, error: () => {} });
  }

  /** Các action kết bạn/follow trong modal (gốc: addFriendForPeople/removeFriendForPeople/...). */
  peopleAddFriend(item: any): void {
    item.isLoadAction = true;
    this.relations.addToFriends(item.id).subscribe({
      next: () => {
        item.isLoadAction = false;
        item.relationStatus = ERelationStatus.FRIEND_REQUEST;
        item.relationStatusText = 'Friend request sent';
        this.showToast(this.tr('toastr.success.friend_request_sent', 'Friend request sent successfully.'), 'success');
      },
      error: (err: any) => {
        item.isLoadAction = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  peopleRemoveFriend(item: any): void {
    if (this.myUserId == null) return;
    item.isLoadAction = true;
    this.relations.removeFromFriends(item.id, this.myUserId as any).subscribe({
      next: () => {
        item.isLoadAction = false;
        item.relationStatus = ERelationStatus.UNFOLLOWED;
        item.relationStatusText = '';
        this.showToast(
          this.tr('toastr.success.friend_removed', '{{userName}} was successfully removed from your friend list.', {
            userName: this.personName(item) || 'User',
          }),
          'success',
        );
      },
      error: (err: any) => {
        item.isLoadAction = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  peopleCancelRequest(item: any): void {
    // Gốc: đang nhận lời mời của người ta thì không được hủy chiều này.
    if (
      (item.relationStatus === ERelationStatus.FRIEND_REQUEST && item.relationStatusText === 'Friend request received') ||
      (item.relationStatus === ERelationStatus.FRIEND_AND_FOLLOW_REQUEST &&
        item.relationStatusText === 'You are being followed and received friend request')
    ) {
      this.showToast(
        this.tr('toastr.error.you_are_being_received_friend_request', 'You are being received friend request.'),
        'error',
      );
      return;
    }
    item.isLoadAction = true;
    this.relations.cancelFriendRequest(item.id).subscribe({
      next: () => {
        item.isLoadAction = false;
        item.relationStatus = ERelationStatus.UNFOLLOWED;
        item.relationStatusText = '';
        this.showToast(this.tr('toastr.success.friend_request_cancelled', 'Friend request canceled successfully.'), 'success');
      },
      error: (err: any) => {
        item.isLoadAction = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  peopleAcceptRequest(item: any): void {
    item.isLoadAction = true;
    this.relations.acceptFriendRequest(item.id).subscribe({
      next: () => {
        item.isLoadAction = false;
        item.relationStatus = ERelationStatus.FRIEND;
        item.relationStatusText = '';
        this.showToast(this.tr('toastr.success.friend_request_accepted', 'Friend request was successfully accepted.'), 'success');
      },
      error: (err: any) => {
        item.isLoadAction = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  peopleRejectRequest(item: any): void {
    item.isLoadAction = true;
    this.relations.rejectFriendRequest(item.id).subscribe({
      next: () => {
        item.isLoadAction = false;
        item.relationStatus = ERelationStatus.UNFOLLOWED;
        item.relationStatusText = '';
        this.showToast(this.tr('toastr.success.friend_request_rejected', 'Friend request rejected successfully.'), 'success');
      },
      error: (err: any) => {
        item.isLoadAction = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  peopleFollow(item: any): void {
    item.isLoadAction = true;
    this.relations.followSeller(item.id).subscribe({
      next: () => {
        item.isLoadAction = false;
        item.relationStatus =
          item.relationStatus === ERelationStatus.FRIEND ? ERelationStatus.FRIEND_AND_FOLLOW : ERelationStatus.FOLLOW;
        this.showToast(
          this.tr('toastr.success.you_are_following', 'You followed {{name}}', { name: this.personName(item) || 'user' }),
          'success',
        );
      },
      error: (err: any) => {
        item.isLoadAction = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  peopleUnfollow(item: any): void {
    item.isLoadAction = true;
    this.relations.unfollowSeller(item.id).subscribe({
      next: () => {
        item.isLoadAction = false;
        item.relationStatus =
          item.relationStatus === ERelationStatus.FRIEND_AND_FOLLOW ? ERelationStatus.FRIEND : ERelationStatus.UNFOLLOWED;
        this.showToast(
          this.tr('toastr.success.you_are_not_following', 'You unfollowed {{name}}', { name: this.personName(item) || 'user' }),
          'success',
        );
      },
      error: (err: any) => {
        item.isLoadAction = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  // ---------- Comments (gốc: handleComment/editComment/deleteComment/likeComment) ----------
  commentsOf(v: ReelVideo | null): ReelComment[] {
    return v?.momentComments || [];
  }

  openComments(): void {
    this.showComments = true;
  }

  sendComment(): void {
    const v = this.current();
    const text = (this.commentDraft || '').trim();
    if (!v?.momentId || !text || this.sendingComment) return;
    this.sendingComment = true;
    const parentId = this.replyTo?.comment_id || null;
    this.momentService.addComment(v.momentId, text, parentId).subscribe({
      next: (res: any) => {
        const data = res?.data;
        if (Array.isArray(data?.comments)) {
          // customerfe's addCommentToMoment returns the updated moment, not a single comment.
          v.momentComments = [...data.comments].sort(this.byCreated);
        } else {
          const posted: ReelComment = data || { comment: text, commentedAt: new Date().toISOString() };
          if (!posted.parent_id && parentId) posted.parent_id = parentId;
          v.momentComments = [...(v.momentComments || []), posted].sort(this.byCreated);
        }
        this.commentDraft = '';
        this.replyTo = null;
        this.hashTags = [];
        this.sendingComment = false;
        this.showToast(this.tr('toastr.success.comment_saved_success', 'Comment saved successfully.'), 'success');
      },
      error: (err: any) => {
        this.sendingComment = false;
        this.showToast(this.errMsg(err, 'toastr.error.post_comment_fail', 'Failed to post comment.'), 'error');
      },
    });
  }

  saveEdit(e: { c: ReelComment; text: string }): void {
    const v = this.current();
    const text = (e.text || '').trim();
    if (!v?.momentId || !e.c.comment_id || !text) {
      this.editingId = null;
      return;
    }
    const prev = e.c.comment;
    e.c.comment = text;
    this.editingId = null;
    this.momentService
      .editComment(v.momentId, { comment_id: e.c.comment_id, comment: text, commentedAt: e.c.commentedAt || '' })
      .subscribe({
        next: () =>
          this.showToast(this.tr('toastr.success.comment_saved_success', 'Comment saved successfully.'), 'success'),
        error: (err: any) => {
          e.c.comment = prev;
          this.showToast(this.errMsg(err), 'error');
        },
      });
  }

  removeComment(c: ReelComment): void {
    const v = this.current();
    if (!v?.momentId || !c.comment_id) return;
    const prev = [...(v.momentComments || [])];
    v.momentComments = prev.filter((x) => x.comment_id !== c.comment_id);
    this.momentService
      .deleteComment(v.momentId, { comment_id: c.comment_id, comment: c.comment || '', commentedAt: c.commentedAt || '' })
      .subscribe({
        next: () =>
          this.showToast(this.tr('activity.sum_act_wall.comment_deleted', 'Comment successfully deleted.'), 'success'),
        error: (err: any) => {
          v.momentComments = prev;
          this.showToast(
            this.errMsg(err, 'activity.sum_act_wall.delete_comment_fail', 'Failed to delete comment.'),
            'error',
          );
        },
      });
  }

  likeComment(e: { c: ReelComment; emoji: string }): void {
    const c = e.c;
    const content = e.emoji || '👍';
    const v = this.current();
    if (!v?.momentId || !c.comment_id) return;
    c.expressions = c.expressions || [];
    const mine = c.expressions.find((x) => String(x.expressedBy) === String(this.myUserId));
    let expr: any;
    if (!mine) {
      expr = { expressedBy: this.myUserId, expression: 'LIKE', expressedAt: new Date(), expressedContent: content };
      c.expressions = [...c.expressions, expr];
    } else if (mine.expressedContent === content) {
      expr = { ...mine };
      c.expressions = c.expressions.filter((x) => String(x.expressedBy) !== String(this.myUserId));
    } else {
      expr = { ...mine, expressedContent: content };
      c.expressions = c.expressions.map((x) => (String(x.expressedBy) === String(this.myUserId) ? expr : x));
    }
    this.momentService.expressComment(v.momentId, c.comment_id, expr).subscribe({
      next: () => {},
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  /** Gợi ý hashtag khi gõ comment (gốc: onSearchHashTag, debounce 1s). */
  onDraftInput(e: { text: string; caret: number }): void {
    this.lastDraftCaretVal = e.caret;
    clearTimeout(this.hashTagTimer);
    const keyword = (e.text || '').slice(0, e.caret).split(' ').pop() || '';
    if (keyword.startsWith('#') && keyword.trim().length > 1) {
      this.hashTagTimer = setTimeout(() => {
        this.momentService.searchHashTag(keyword).subscribe({
          next: (res: any) => (this.hashTags = res?.data || []),
          error: () => (this.hashTags = []),
        });
      }, 800);
    } else {
      this.hashTags = [];
    }
  }

  /** Chèn hashtag đã chọn vào draft (gốc: handleSelectedHashTag). */
  pickHashTag(tag: string): void {
    const text = this.commentDraft || '';
    const caret = Math.min(this.lastDraftCaretVal || text.length, text.length);
    const head = text.slice(0, caret);
    const tail = text.slice(caret);
    const hashStart = head.lastIndexOf('#');
    this.commentDraft = (hashStart >= 0 ? head.slice(0, hashStart) : head) + tag + ' ' + tail;
    this.hashTags = [];
  }

  private lastDraftCaretVal = 0;

  // ---------- Report (gốc: reportReasons + report + reportVideo) ----------
  openReport(): void {
    const v = this.current(); if (!v || this.reportBusy) return;
    this.reportInfo = null; this.savedVideoReport = null; this.showReport = true; this.reportBusy = true;
    this.momentService.getReportedVideo(v.id).subscribe({
      next: res => { if (this.current()?.id !== v.id) { this.reportBusy = false; return; } this.reportInfo = res?.data || {}; this.savedVideoReport = String(this.reportInfo?.report?.reportedBy) === String(this.myUserId) ? this.reportInfo.report : null; this.reportBusy = false; },
      error: e => { this.reportBusy = false; this.showReport = false; this.showToast(this.errMsg(e), 'error'); },
    });
  }
  submitReport(e: { reason: string; isOther?: boolean }): void {
    const v = this.current();
    const reason = (e.reason || '').trim();
    if (!v || !reason || this.reportBusy || this.myUserId == null) return;
    this.reportBusy = true;
    this.momentService.saveVideoReport({ _id: this.reportInfo?._id, videoId: v.id, report: { reportedBy: this.myUserId, message: reason, isOthers: !!e.isOther } }).pipe(
      switchMap(() => this.momentService.reportVideo({ momentId: v.momentId, id: v.id, reported: true })),
    ).subscribe({
      next: () => {
        this.reportBusy = false;
        this.showReport = false;
        this.showToast(this.tr('toastr.success.report_success', 'Your report is submitted successfully.'), 'success');
      },
      error: (err: any) => {
        this.reportBusy = false;
        this.showToast(this.errMsg(err), 'error');
      },
    });
  }

  // ---------- Share (gốc: shareToFacebook/Twitter/copyLinkUrlVideo) ----------
  videoLink(): string {
    const v = this.current();
    return v ? `${location.origin}/social/video?videoId=${encodeURIComponent(v.id)}` : location.origin;
  }

  copyLink(): void {
    const link = this.videoLink();
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() => this.showToast(this.tr('copied_to_clipboard', 'Copied to clipboard.'), 'success'))
        .catch(() => this.showToast(this.tr('toastr.error.request_failed', 'Request failed.'), 'error'));
    } else {
      this.showToast(this.tr('copied_to_clipboard', 'Copied to clipboard.'), 'success');
    }
    this.showShare = false;
  }

  shareFacebook(): void {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(this.videoLink()), '_blank');
    this.showShare = false;
  }

  shareTwitter(): void {
    window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(this.videoLink()), '_blank');
    this.showShare = false;
  }

  /** Gốc: shareToWeChat / shareToInstagram. */
  shareWeChat(): void {
    window.open('weixin://dl/business/?ticket=' + encodeURIComponent(this.videoLink()), '_blank');
    this.showShare = false;
  }

  shareInstagram(): void {
    window.open('https://www.instagram.com/?url=' + encodeURIComponent(this.videoLink()), '_blank');
    this.showShare = false;
  }

  /** Bấm hashtag trong mô tả/comment -> mở lưới duyệt video lọc theo tag (gốc: navigateHashtag). */
  goHashtag(tag: string): void {
    this.router.navigate([], { queryParams: { tag }, queryParamsHandling: 'merge' });
    this.openGrid('browse', '#' + tag.replace(/^#/, ''));
  }

  /** Ảnh preview lúc loading (gốc: getVideoThumbnail/getImageFromVideo). */
  posterOf(v: ReelVideo | null): string {
    const url = v?.attachmentUrl || '';
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&#/]+)/i);
    if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
    if (url.startsWith('https://sftp.bynfor.com') && url.lastIndexOf('.') > url.lastIndexOf('/')) {
      return url.substring(0, url.lastIndexOf('.')) + '.webp';
    }
    return '';
  }

  // ---------- Modal profile creator (gốc: showModalProfile/isMyProfile/...) ----------
  isMyProfile(): boolean {
    return !!this.memberProfile && this.myUserId != null && String(this.memberProfile.id) === String(this.myUserId);
  }

  openProfileFor(user: any): void {
    if (!user) return;
    // Comment chỉ có createdByFull (không id số) -> fallback dùng creator đang xem.
    const target = user?.id != null ? user : this.creator;
    if (!target) return;
    this.showProfile = true;
    this.profileLoading = true;
    this.memberProfile = null;
    this.relationUser = null;
    this.showComments = false;
    this.userService.getUserById(target.id).subscribe({
      next: (res: any) => {
        this.memberProfile = res?.data || null;
        this.profileLoading = false;
      },
      error: () => (this.profileLoading = false),
    });
    // Relation theo email như gốc (searchUserProfileModal), fallback theo id.
    const email = target.email;
    if (email) {
      this.userService.findUserByMobileNo(email, 1).subscribe({
        next: (resp: any) => {
          const found = ((resp?.data?.list) || []).filter((x: any) => x.email === email);
          this.relationUser = found.length ? found[0] : null;
          this.syncCreatorFollowFromRelation(target.id);
        },
        error: () => this.syncCreatorFollowFromRelation(target.id),
      });
    } else {
      this.syncCreatorFollowFromRelation(target.id);
    }
  }

  private syncCreatorFollowFromRelation(userId: number | string): void {
    this.relations.getCustomerRelation(userId).subscribe({
      next: (res: any) => {
        const status = res?.data?.status || '';
        if (!this.relationUser) this.relationUser = { relationStatus: status, relationStatusText: '' };
        if (this.creator && String(this.creator.id) === String(userId)) {
          this.isCreatorFollowed =
            status === 'FOLLOW' || status === 'FRIEND_AND_FOLLOW' || status === 'FRIEND_AND_FOLLOW_REQUEST';
        }
      },
      error: () => {},
    });
  }

  closeProfile(): void {
    this.showProfile = false;
  }

  profileAddFriend(): void {
    if (!this.memberProfile?.id) return;
    this.relations.addToFriends(this.memberProfile.id).subscribe({
      next: () => {
        this.relationUser = { ...(this.relationUser || {}), relationStatus: 'FRIEND_REQUEST', relationStatusText: 'Friend request sent' };
        this.showToast(this.tr('toastr.success.friend_request_sent', 'Friend request sent successfully.'), 'success');
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  profileCancelRequest(): void {
    if (!this.memberProfile?.id) return;
    this.relations.cancelFriendRequest(this.memberProfile.id).subscribe({
      next: () => {
        this.relationUser = { ...(this.relationUser || {}), relationStatus: 'UNFOLLOWED', relationStatusText: '' };
        this.showToast(this.tr('toastr.success.friend_request_cancelled', 'Friend request canceled successfully.'), 'success');
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  profileAcceptRequest(): void {
    if (!this.memberProfile?.id) return;
    this.relations.acceptFriendRequest(this.memberProfile.id).subscribe({
      next: () => {
        this.relationUser = { ...(this.relationUser || {}), relationStatus: 'FRIEND', relationStatusText: '' };
        this.showToast(this.tr('toastr.success.friend_request_accepted', 'Friend request was successfully accepted.'), 'success');
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  profileRemoveFriend(): void {
    if (!this.memberProfile?.id || this.myUserId == null) return;
    alertify.confirm(
      this.i18n.t('alertify.do_you_want_to_remove_friend'),
      (ok: boolean) => {
        if (!ok) return;
        this.relations.removeFromFriends(this.memberProfile.id, this.myUserId as any).subscribe({
          next: () => {
            this.relationUser = { ...(this.relationUser || {}), relationStatus: 'UNFOLLOWED', relationStatusText: '' };
            this.showToast(this.tr('cancel_friend_successfully', 'Friend removed successfully.'), 'success');
          },
          error: (err: any) => this.showToast(this.errMsg(err), 'error'),
        });
      },
    ).set({ title: this.i18n.t('common.confirm'), movable: false }).set('labels', { ok: this.i18n.t('alertify.ok'), cancel: this.i18n.t('common.cancel') });
  }

  profileFollow(): void {
    if (!this.memberProfile?.id) return;
    this.relations.followSeller(this.memberProfile.id).subscribe({
      next: () => {
        const cur = this.relationUser?.relationStatus;
        this.relationUser = {
          ...(this.relationUser || {}),
          relationStatus: cur === 'FRIEND' ? 'FRIEND_AND_FOLLOW' : 'FOLLOW',
          relationStatusText: 'You are following',
        };
        if (this.creator && String(this.creator.id) === String(this.memberProfile.id)) this.isCreatorFollowed = true;
        this.showToast(
          this.tr('toastr.success.you_are_following', 'You followed {{name}}', {
            name: this.personName(this.memberProfile) || 'user',
          }),
          'success',
        );
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  profileUnfollow(): void {
    if (!this.memberProfile?.id) return;
    this.relations.unfollowSeller(this.memberProfile.id).subscribe({
      next: () => {
        const cur = this.relationUser?.relationStatus;
        this.relationUser = {
          ...(this.relationUser || {}),
          relationStatus: cur === 'FRIEND_AND_FOLLOW' ? 'FRIEND' : 'UNFOLLOWED',
          relationStatusText: '',
        };
        if (this.creator && String(this.creator.id) === String(this.memberProfile.id)) this.isCreatorFollowed = false;
        this.showToast(
          this.tr('toastr.success.you_are_not_following', 'You unfollowed {{name}}', {
            name: this.personName(this.memberProfile) || 'user',
          }),
          'success',
        );
      },
      error: (err: any) => this.showToast(this.errMsg(err), 'error'),
    });
  }

  // ---------- Lưới duyệt video (gốc: category-video grid + video-history) ----------
  openHistory(): void {
    this.openGrid('history', '');
  }

  openGrid(mode: 'browse' | 'history', keyword: string): void {
    this.pauseAll();
    this.showGrid = true;
    this.gridMode = mode;
    this.gridKeyword = keyword;
    this.gridPage = 1;
    this.gridVideos = [];
    this.fetchGrid(false);
  }

  closeGrid(): void {
    this.showGrid = false;
    if (this.current() && this.tab !== 'FRIEND') this.playCurrent();
  }

  gridModeChange(mode: 'browse' | 'history'): void {
    this.gridMode = mode;
    this.gridPage = 1;
    this.gridVideos = [];
    if (mode === 'history') this.gridKeyword = '';
    this.fetchGrid(false);
  }

  gridSearch(keyword: string): void {
    this.gridKeyword = (keyword || '').trim();
    this.gridPage = 1;
    this.gridVideos = [];
    this.fetchGrid(false);
  }

  gridCategoryChange(id: string | null): void {
    this.gridCategory = id;
    this.gridPage = 1;
    this.gridVideos = [];
    this.fetchGrid(false);
  }

  gridLoadMore(): void {
    if (this.gridLoadingMore) return;
    this.fetchGrid(true);
  }

  private fetchGrid(more: boolean): void {
    if (more) this.gridLoadingMore = true;
    else this.gridLoading = true;
    const done = (list: any[]) => {
      this.gridVideos = more ? [...this.gridVideos, ...list] : list;
      this.gridHasMore = list.length >= this.gridSize;
      if (list.length) this.gridPage++;
      this.gridLoading = false;
      this.gridLoadingMore = false;
    };
    if (this.gridMode === 'history') {
      this.momentService.getVideoHistories(this.gridPage, this.gridSize).subscribe({
        next: (res: any) => done(res?.data || []),
        error: () => {
          this.gridLoading = false;
          this.gridLoadingMore = false;
        },
      });
    } else {
      this.momentService.getNewVideos(this.gridPage, this.gridSize, this.gridCategory || undefined, this.gridKeyword).subscribe({
        next: (res: any) => done(res?.data || []),
        error: () => {
          this.gridLoading = false;
          this.gridLoadingMore = false;
        },
      });
    }
  }

  /** Bấm 1 ô trong lưới -> xem reels tại video đó (gốc: clickDetailVideo). */
  gridPlay(video: any): void {
    if (video?.momentId) this.momentService.addVideoHistory(video.momentId).subscribe({ next: () => {}, error: () => {} });
    this.showGrid = false;
    if (video?.id) this.openVideoById(video.id);
    else if (video) {
      this.videos = [video as ReelVideo, ...this.videos.filter((x) => x.id !== video.id)];
      this.selectedIndex = 0;
      this.afterSelect();
    }
  }

  private byCreated(a: ReelComment, b: ReelComment): number {
    return String(a?.commentedAt || '').localeCompare(String(b?.commentedAt || ''));
  }
}
