import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import * as CryptoJS from 'crypto-js';
import { I18NEXT_SERVICE, ITranslationService } from 'angular-i18next';
import { MomentService } from '../../services/moment.service';
import { RelationsService } from '../../services/relations.service';
import { UserService } from '../../services/user.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AlertService } from '../../services/alert.service';

declare let alertify: any;

function withToastFallback(t: any): ToastService {
  if (t && typeof t.show === 'function' && typeof t.success === 'function' && typeof t.error === 'function') return t;
  return { show() {}, success() {}, error() {}, dismiss() {}, tr: (_k: string, f: string) => f } as unknown as ToastService;
}

@Component({
  selector: 'app-social-moment',
  standalone: false,
  templateUrl: './social-moment.component.html',
  styleUrls: ['./social-moment.component.scss'],
})
export class SocialMomentComponent implements OnInit, OnDestroy {
  me: any = null;
  actionSuccess = '';
  gallery: any[] = [];
  galleryIndex = 0;
  actionError = '';
  reactionsTarget: any = null;
  reportTarget: any = null;
  reporting = false;
  replyTargets: Record<string, any> = {};
  readonly reactions = ['👍', '💖', '😍', '😀', '😱', '😭', '😡'];
  reactionMenuId: string | null = null;
  private feedSequence = 0;
  private feedRequest?: Subscription;
  private pinned: any = null;
  private selectedPostId = '';
  private normalize(m: any): any {
    const expressions = m.expressions || [];
    m.likeCount = Array.isArray(m.expressions) ? expressions.filter((e: any) => e.expression === 'LIKE').length : (m.likeCount || 0);
    m.likedByMe = expressions.some((e: any) => e.expression === 'LIKE' && String(e.expressedBy) === this.meId);
    m.isEndorsedByMe = (m.endorsements || []).some((e: any) => String(e.userId) === this.meId);
    return m;
  }
  private fail(e: any): void { this.actionError = e?.error?.message || 'social.actionFailed'; this.toast?.error(e); }
  canInteract(comment = false, moment?: any): boolean {
    if (moment?.blocked || moment?.userBlocked) { this.actionError = 'user_has_blocked_you'; return false; }
    if (!this.meId) { this.actionError = 'social.profileRequired'; return false; }
    if (!this.me?.stateId) { this.actionError = 'social.completeProfile'; return false; }
    if (comment && (this.me?.status === 'MUTE_MOMENT' || this.me?.userStatus?.status === 'MUTE_MOMENT')) { this.actionError = 'your_account_is_not_allowed_to_post_moments_due_to_some_behavior'; return false; }
    this.actionError = ''; return true;
  }
  taggedPeople(m: any): any[] { return [...new Map([...(m.tagUsers || []), ...(m.taggers || [])].map((u: any) => [String(u.id), u])).values()]; }
  tagProfile(user: any): void { const id = UserService.profileId(user); if (id) this.router.navigate(['/social/social-media-profile', id]); }
  reaction(m: any): string { return (m.expressions || []).find((e: any) => e.expression === 'LIKE' && String(e.expressedBy) === this.meId)?.expressedContent || '👍'; }
  react(m: any, emoji: string): void {
    if (m.liking || !this.canInteract(false, m)) return;
    const operation = m.likedByMe && this.reaction(m) === emoji ? 'REMOVE' : 'ADD';
    m.liking = true; this.reactionMenuId = null;
    this.momentService.express(m._id, operation, 'LIKE', operation === 'ADD' ? emoji : '').subscribe({
      next: res => { if (res?.data?.expressions) m.expressions = res.data.expressions; else { m.expressions = [...(m.expressions || []).filter((e: any) => !(e.expression === 'LIKE' && String(e.expressedBy) === this.meId)), ...(operation === 'ADD' ? [{ expression: 'LIKE', expressedBy: this.meId, expressedContent: emoji }] : [])]; } this.normalize(m); m.liking = false; },
      error: e => { m.liking = false; this.fail(e); },
    });
  }
  endorse(m: any): void {
    if (this.isMine(m) || m.endorsing || !this.canInteract(false, m)) return;
    const operation = m.isEndorsedByMe ? 'REMOVE' : 'ADD'; m.endorsing = true;
    this.momentService.endorse(m._id, operation).subscribe({
      next: res => { if (res?.data?.endorsements) m.endorsements = res.data.endorsements; m.endorsementCount = res?.data?.endorsementCount ?? Math.max(0, (m.endorsementCount || 0) + (operation === 'ADD' ? 1 : -1)); m.isEndorsedByMe = operation === 'ADD'; m.endorsing = false; },
      error: e => { m.endorsing = false; this.fail(e); },
    });
  }
  async report(data: { reason: string; other?: string; note?: string; images?: File[]; videoFile?: File | null; videoUrl?: string; documents?: File[] }): Promise<void> {
    if (!this.reportTarget || this.reporting) return;
    const words = (data.reason || '').trim() ? (data.reason || '').trim().split(/\s+/).length : 0;
    const noteWords = (data.note || '').trim() ? (data.note || '').trim().split(/\s+/).length : 0;
    if (!((data.reason || '').trim()) || words > 120 || noteWords > 120) { this.actionError = 'social.reportReason120'; return; }
    this.reporting = true;
    try {
      const [imageUrls, videoUrls, fileUrls] = await Promise.all([
        this.uploadReportImages(data.images || []),
        this.uploadReportVideo(data.videoFile, data.videoUrl),
        this.uploadReportDocuments(data.documents || []),
      ]);
      const res: any = await firstValueFrom(this.momentService.reportMoment(this.reportTarget._id, data.reason.trim(), { imageUrls, videoUrls, fileUrls, note: data.note }));
      const reasons = res?.data?.reportReasons || this.reportTarget.reportReasons || [];
      if (reasons.length >= 3) this.moments = this.moments.filter(x => x._id !== this.reportTarget._id);
      else this.reportTarget.reportReasons = reasons;
      this.reporting = false; this.reportTarget = null;
      this.toast?.success('social.reportSent', 'Moment reported.');
    } catch (e) {
      this.reporting = false;
      this.fail(e);
    }
  }

  private reportUploadUrls(response: any): string[] {
    const items = Array.isArray(response?.data) ? response.data : (response?.data ? [response.data] : []);
    return items.map((item: any) => typeof item === 'string' ? item : (item?.origin || item?.url || item?.attachmentUrl || item?.fileUrl || '')).filter(Boolean);
  }

  private async uploadReportImages(files: File[]): Promise<string[]> {
    if (!files.length) return [];
    const form = new FormData();
    files.forEach(file => form.append('uploadfiles', file, file.name));
    return this.reportUploadUrls(await firstValueFrom(this.momentService.uploadImages(form)));
  }

  private async uploadReportVideo(file?: File | null, url = ''): Promise<string[]> {
    if (url.trim()) return [url.trim()];
    if (!file) return [];
    const form = new FormData();
    form.append('uploadfiles', file, file.name);
    return this.reportUploadUrls(await firstValueFrom(this.momentService.uploadVideos(form)));
  }

  private async uploadReportDocuments(files: File[]): Promise<string[]> {
    if (!files.length) return [];
    const uploaded = await Promise.all(files.map(async file => {
      const form = new FormData();
      form.append('uploadfile', file, file.name);
      return this.reportUploadUrls(await firstValueFrom(this.momentService.uploadDocuments(form)));
    }));
    return uploaded.flat();
  }
  giftClaimed(m: any): boolean {
    const ids = (m.redPacketGrabbedUsers || []).map((id: any) => String(id));
    const grabbed = ids.includes(String(this.meId));
    const full = !!m.quantityWallet && (m.redPacketGrabbedUsers || []).length >= m.quantityWallet;
    return grabbed || full || Number(m.availableMoney) <= 0;
  }
  /** Có phải bài tag công khai mà mình không nằm trong tag (giống isTagWithPublic gốc). */
  isTagWithPublic(m: any): boolean {
    return (m.tagUsers || []).some((u: any) => String(u.id) === String(this.meId)) && m.accessedBy === 'IS_PUBLIC';
  }
  /** 3 trạng thái red-packet như gốc: img (grab được) / img2 (đã lấy) / img3 (disabled). */
  redpacketClass(m: any): string {
    if ((m.availableMoney || m.availablePoints) && !this.giftClaimed(m)) return 'red-packet-img';
    if (this.giftClaimed(m)) return 'red-packet-img2';
    if (!this.isTagWithPublic(m) && (m.tagUsers || []).length > 0 && m.accessedBy === 'IS_PUBLIC') return 'red-packet-img3';
    if (m.settlementDoneRedPacket || !m.isGrab) return 'red-packet-img3';
    return 'red-packet-img2';
  }
  redpacketTip(m: any): string {
    if (this.isMine(m)) return 'social.ownGift';
    if (this.giftClaimed(m)) return 'social.rewardClaimed';
    if (m.accessedBy === 'ALL_FOLLOWERS') return 'social.onlyFollowers';
    if (m.accessedBy === 'ALL_FRIENDS') return 'social.onlyFriends';
    if (m.accessedBy === 'ALL_FRIENDS_AND_FOLLOWERS') return 'social.onlyFriendsFollowers';
    if (m.settlementDoneRedPacket || !m.isGrab) return 'social.giftOver';
    return 'social.claimGift';
  }
  packetTarget: { moment: any; view: 'grab' | 'details'; luckyNext: boolean } | null = null;

  canGrabGift(m: any): boolean {
    const tags = this.taggedPeople(m);
    return !!this.meId && !this.isMine(m) && !m.grabbing && !m.settlementDoneRedPacket && m.isGrab === true && !this.giftClaimed(m) && Number(m.availableMoney) > 0 && (!m.quantityWallet || (m.redPacketGrabbedUsers || []).length < m.quantityWallet) && (m.accessedBy !== 'IS_PUBLIC' || !tags.length || tags.some(u => String(u.id) === this.meId));
  }

  /** Click phong bì trên card (giống clickShowGrabbersShare gốc). */
  openPacketGrab(m: any): void {
    if (!this.canInteract(false, m)) return;
    const grabbedIds = (m.redPacketGrabbedUsers || []).map((id: any) => String(id));
    if (grabbedIds.includes(String(this.meId))) { this.openPacketDetails(m); return; }
    const settled = !!m.settlementDoneRedPacket;
    const full = !!m.quantityWallet && (m.redPacketGrabbedUsers || []).length >= m.quantityWallet;
    const out = Number(m.availableMoney) <= 0;
    this.packetTarget = { moment: m, view: 'grab', luckyNext: settled || full || out };
  }

  /** Link View rewards (giống clickShowGrabbers gốc). */
  openPacketDetails(m: any): void {
    if (!this.canInteract(false, m)) return;
    this.packetTarget = { moment: m, view: 'details', luckyNext: false };
  }

  onPacketUpdated(updated: any): void {
    if (!updated) return;
    const target = this.moments.find(x => x._id === updated._id);
    if (target) this.normalize(Object.assign(target, updated));
    if (updated.moneyGrabbed != null) {
      this.actionSuccess = String(updated.moneyGrabbed);
      this.toast?.show(`${this.toast?.tr('social.rewardReceived', 'Reward received') ?? 'Reward received'}: ${updated.moneyGrabbed}`, 'success');
    }
  }
  rootComments(m: any): any[] { return (m.comments || []).filter((c: any) => !c.parent_id && !c.parentId); }
  replies(m: any, c: any): any[] { return [...(m.comments || []), ...(m.replies || [])].filter((r: any) => String(r.parent_id || r.parentId || '') === String(this.commentId(c))); }
  reply(m: any, c: any): void { this.replyTargets[m._id] = c; }
  moments: any[] = [];
  page = 1;
  pageSize = 20;
  loading = false;
  loadingMore = false;
  error = '';
  expandedComments: { [id: string]: boolean } = {};
  commentDrafts: { [id: string]: string } = {};
  commentTags: { [id: string]: string[] } = {};
  sendingComment: { [id: string]: boolean } = {};
  topPost = false;
  reportedFeed = false;
  myPost = false;
  friendPost = false;
  hiddenFeed = false;
  storeFeed = false;
  storeId = '';
  filterUserId = '';
  meId = '';
  hasMore = true;
  private scrollHandler: any;
  openMenuId: string | null = null;
  copiedId: string | null = null;
  busyRelation: { [id: string]: boolean } = {};
  private querySub: Subscription | null = null;
  private pollTimer: any = null;

  constructor(
    private momentService: MomentService,
    private relationsService: RelationsService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
    private alertService: AlertService,
    @Inject(I18NEXT_SERVICE) private i18n: ITranslationService,
  ) {
    this.toast = withToastFallback(toast);
  }

  /** Avatar/tên -> trang profile của user đó (giống customerfe). */
  goToProfile(m: any): void {
    const id = UserService.profileId(m?.createdByFull) || UserService.profileId(m?.userResponseMoment) || m?.from || m?.createdBy;
    if (id) this.router.navigate(['/social/social-media-profile', id]);
  }

  ngOnInit(): void {
    this.userService.getCurrentUser().subscribe((me: any) => {
      this.me = me; this.meId = UserService.profileId(me); this.moments.forEach(m => this.normalize(m));
      this.preloadForwardLists();
    });
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      this.filterUserId = params.get('userId') || '';
      const viewId = params.get('viewId') || '';
      if (!this.filterUserId && viewId) this.filterUserId = this.decryptViewId(viewId);
      this.storeId = params.get('store') || '';
      this.storeFeed = !!this.storeId;
      const postId = params.get('postId') || '';
      this.selectedPostId = postId; this.pinned = null;
      this.loadFeed(true);
      if (postId) this.pinPost(postId);
    });
    this.scrollHandler = () => {
      const nearBottom = window.innerHeight + window.scrollY + 1000 >= document.body.scrollHeight;
      if (nearBottom && this.hasMore && !this.loading && !this.loadingMore && this.moments.length) {
        this.loadFeed(false);
      }
    };
    window.addEventListener('scroll', this.scrollHandler);
    this.pollTimer = setInterval(() => {
      if (document.hidden || this.loading || this.loadingMore || this.reportedFeed || this.hiddenFeed) return;
      const req = this.storeFeed
        ? this.momentService.getWallMoments(5, 1, false, false, undefined, false, false, this.storeId)
        : this.momentService.getWallMoments(5, 1, false, false, undefined, false);
      req.subscribe({
        next: (res: any) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          const known = new Set(this.moments.map(x => x._id));
          const fresh = list.filter(x => !known.has(x._id)).map(x => this.normalize(x));
          if (fresh.length) this.moments = [...fresh, ...this.moments];
        },
        error: () => {},
      });
    }, 60000);
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe(); this.feedRequest?.unsubscribe(); this.feedSequence++;
    window.removeEventListener('scroll', this.scrollHandler);
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /** Giải mã ?viewId= (CryptoJS.AES 'userId' như customerfe), fallback id thô. */
  private decryptViewId(viewId: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(decodeURIComponent(viewId), 'userId');
      const text = bytes.toString(CryptoJS.enc.Utf8).replace(/"/g, '').trim();
      if (text) return text;
    } catch {}
    return viewId;
  }

  /** Ghim 1 bài cụ thể lên đầu feed khi mở link ?postId=. */
  private pinPost(postId: string): void {
    this.momentService.getWallMoment(postId).subscribe({
      next: (res: any) => {
        const post = res?.data;
        if (post && this.selectedPostId === postId) {
          this.pinned = this.normalize(post);
          this.moments = [this.pinned, ...this.moments.filter(x => x._id !== post._id)];
          setTimeout(() => {
            const el = document.getElementById('moment-' + post._id);
            if (el) el.scrollIntoView({ block: 'center' });
          }, 300);
        }
      }, error: e => this.fail(e),
    });
  }

  /** Nhận filter từ nút phễu trên header Make a Post. */
  onFilterChange(f: { myPost: boolean; friendPost: boolean; topPost?: boolean; reported?: boolean; hidden?: boolean; store?: boolean }): void {
    this.topPost = !!f.topPost; this.reportedFeed = !!f.reported; this.pinned = null;
    this.myPost = f.myPost;
    this.friendPost = f.friendPost;
    this.hiddenFeed = !!f.hidden;
    if (f.hidden) { this.storeFeed = false; this.storeId = ''; }
    if (f.store === false) { this.storeFeed = false; this.storeId = ''; }
    if (this.storeFeed && !this.storeId) this.storeFeed = false;
    this.loadFeed(true);
  }

  /** Bài vừa đăng xong -> chèn lên đầu feed. */
  onPosted(moment: any): void {
    if (moment) this.moments = [this.normalize(moment), ...this.moments.filter(m => m._id !== moment._id)];
  }

  loadFeed(reset = false): void {
    if (!reset && (this.loading || this.loadingMore)) return;
    if (reset) {
      this.page = 1;
      this.loading = true; this.loadingMore = false;
      this.error = '';
      this.hasMore = true;
    } else {
      if (!this.hasMore) return;
      this.loadingMore = true;
    }
    if (reset) this.feedRequest?.unsubscribe();
    const sequence = ++this.feedSequence;
    const request = this.reportedFeed ? this.momentService.getReportedMoments(this.page, this.pageSize) : this.momentService.getWallMoments(this.pageSize, this.page, this.myPost, this.friendPost, this.filterUserId || undefined, this.topPost, this.hiddenFeed, this.storeFeed ? this.storeId : undefined);
    this.feedRequest = request.subscribe({
      next: (res: any) => {
        if (sequence !== this.feedSequence) return;
        const list = this.reportedFeed ? (res?.data?.data || []) : (Array.isArray(res?.data) ? res.data : []);
        const merged = reset ? list : [...this.moments, ...list];
        this.moments = [...new Map([...(this.pinned ? [this.pinned] : []), ...merged].map(m => [m._id, this.normalize(m)])).values()];
        if (list.length < this.pageSize) this.hasMore = false;
        this.page++;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => {
        if (sequence !== this.feedSequence) return;
        this.loading = false;
        this.loadingMore = false;
        this.error = 'social.loadFailed';
        this.toast?.show(this.toast?.tr('social.loadFailed', 'Load failed.') ?? 'Load failed.', 'error');
      },
    });
  }

  private abbrev(first: any, last: any, full: any, user: any): string {
    const f = (first || '').trim();
    const l = (last || '').trim();
    if (f) return (f.charAt(0) + (l ? l.charAt(0) : '')).toUpperCase();
    const fullName = (full || '').trim().replace(/\s+/g, ' ');
    if (fullName) {
      const parts = fullName.split(' ');
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return fullName.replace(/\s+/g, '').slice(0, 2).toUpperCase();
    }
    const name = (user || '').trim();
    return name ? name.replace(/\s+/g, '').slice(0, 2).toUpperCase() : '';
  }

  private displayName(u: any): string {
    const full = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
    if (full) return full;
    return (u?.fullName || u?.name || u?.userName || '').trim();
  }

  poster(m: any): any {
    return m?.createdByFull || m?.userResponseMoment || {};
  }

  tagExtras(m: any): any[] {
    const users = [m?.createdByFull, ...(m?.comments || []).map((c: any) => c?.createdByFull)];
    const seen = new Set<string>();
    const out: any[] = [];
    for (const u of users) {
      const id = UserService.profileId(u);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        userName: u.userName || '',
        fullName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.fullName || u.name || '',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        profilePictureUrl: u.profilePictureUrl || '',
      });
    }
    return out;
  }

  posterName(m: any): string {
    return this.displayName(this.poster(m));
  }

  posterAvatar(m: any): string {
    const url = (this.poster(m).profilePictureUrl || '').trim();
    return url && url !== 'null' ? url : '';
  }

  posterText(m: any): string {
    const u = this.poster(m);
    return this.abbrev(u.firstName, u.lastName, u.fullName || u.name, u.userName) || '?';
  }

  decodeText(s: any): string {
    const str = (s ?? '').toString();
    if (!str) return '';
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  }

  userName(m: any): string {
    return this.posterName(m);
  }

  avatarText(m: any): string {
    return this.posterText(m);
  }

  images(m: any): any[] {
    return (m?.attachments || []).filter((a: any) => (!a?.attachmentType || a?.attachmentType === 'IMAGE') && a?.attachmentUrl);
  }

  files(m: any): any[] { return (m?.attachments || []).filter((a: any) => a?.attachmentType && !['IMAGE', 'VIDEO'].includes(a.attachmentType) && /^https?:\/\//i.test(a.attachmentUrl || '')); }
  videos(m: any): any[] {
    return (m?.attachments || []).filter((a: any) => a?.attachmentType === 'VIDEO' && a?.attachmentUrl);
  }

  toggleLike(m: any): void { this.react(m, this.reaction(m)); }

  revokeReport(m: any): void {
    if (m.revoking) return; m.revoking = true;
    this.momentService.revokeReport(m._id).subscribe({ next: () => { m.revoking = false; this.moments = this.moments.filter(x => x._id !== m._id); this.toast?.success('social.reportRevoked', 'Report revoked.'); }, error: e => { m.revoking = false; this.fail(e); } });
  }
  toggleDislike(m: any): void {
    if (m.disliking || !this.canInteract(false, m)) return;
    const disliked = (m.expressions || []).some((e: any) => e.expression === 'DISLIKE' && String(e.expressedBy) === this.meId);
    m.disliking = true;
    this.momentService.express(m._id, disliked ? 'REMOVE' : 'ADD', 'DISLIKE', disliked ? '' : '👎').subscribe({
      next: res => { if (res?.data?.expressions) m.expressions = res.data.expressions; this.normalize(m); m.disliking = false; }, error: e => { m.disliking = false; this.fail(e); },
    });
  }
  dislikeCount(m: any): number { return (m.expressions || []).filter((e: any) => e.expression === 'DISLIKE').length; }
  toggleComments(m: any): void {
    this.expandedComments[m._id] = !this.expandedComments[m._id];
  }

  sendComment(m: any): void {
    const text = (this.commentDrafts[m._id] || '').trim();
    if (!text || this.sendingComment[m._id] || !this.canInteract(true, m)) return;
    this.sendingComment[m._id] = true;
    const tags = this.commentTags[m._id] || [];
    this.momentService.addComment(m._id, text, this.commentId(this.replyTargets[m._id]) || undefined, tags).subscribe({
      next: (res: any) => {
        if (Array.isArray(res?.data?.comments)) m.comments = res.data.comments;
        else if (res?.data?.comment_id || (res?.data?._id && res?.data?.comment)) m.comments = [...(m.comments || []), res.data];
        else { this.sendingComment[m._id] = false; this.actionError = 'social.actionFailed'; return; }
        delete this.replyTargets[m._id];
        this.commentDrafts[m._id] = '';
        this.commentTags[m._id] = [];
        this.sendingComment[m._id] = false;
        this.toast?.success('social.commentPosted', 'Comment posted.');
      },
      error: e => {
        this.fail(e);
        this.sendingComment[m._id] = false;
      },
    });
  }

  readonly commentPreview = 3;
  viewAllComments: { [id: string]: boolean } = {};
  commentMenuId: string | null = null;
  editingCommentId: string | null = null;
  editDraft = '';
  savingEdit = false;
  likedComments: { [id: string]: boolean } = {};

  // ---------- thanh reaction hover (đúng 7 emoji của app-social-moment-emoji gốc) ----------
  readonly reactionEmojis = ['👍', '💖', '😍', '😀', '😱', '😭', '😡'];
  reactionFor: string | null = null;
  private reactionTimer: any = null;

  openReactions(c: any): void {
    clearTimeout(this.reactionTimer);
    this.reactionFor = this.commentId(c);
  }

  scheduleCloseReactions(): void {
    clearTimeout(this.reactionTimer);
    this.reactionTimer = setTimeout(() => (this.reactionFor = null), 250);
  }

  editingPostId: string | null = null;
  editPostDraft = '';
  savingPost = false;
  deletingPostId: string | null = null;

  // ---------- sửa bài qua popup Edit Moment ----------
  editingMoment: any = null;

  startEditPost(m: any): void {
    this.editingMoment = m;
    this.openMenuId = null;
  }

  onEditSaved(updated: any): void {
    if (updated && this.editingMoment) {
      Object.assign(this.editingMoment, updated);
    }
    this.editingMoment = null;
  }

  cancelEditPost(): void {
    this.editingPostId = null;
    this.editPostDraft = '';
  }

  saveEditPost(m: any): void {
    const text = (this.editPostDraft || '').trim();
    if (!text || this.savingPost) return;
    this.savingPost = true;
    this.momentService.updateMoment({ ...m, content: text, description: text }).subscribe({
      next: (res: any) => {
        const updated = res?.data || {};
        m.content = updated.content ?? text;
        m.description = updated.description ?? text;
        this.savingPost = false;
        this.cancelEditPost();
        this.toast?.success('social.postPublished', 'Moment published.');
      },
      error: (e) => { this.savingPost = false; this.toast?.error(e); },
    });
  }

  deletePost(m: any): void {
    if (this.deletingPostId) return;

    if (m?.lockMomentStatus === 'YES') { this.actionError = 'social.lockedMoment'; return; }
    this.openMenuId = null;
    alertify.confirm(
      this.i18n.t('alertify.do_you_want_to_remove_a_moment'),
      (ok: boolean) => {
        if (!ok) return;
        this.deletingPostId = m._id;
        this.momentService.deleteMoment(m._id).subscribe({
          next: () => {
            this.moments = this.moments.filter((x) => x._id !== m._id);
            this.deletingPostId = null;
            this.toast?.success('social.postDeleted', 'Moment deleted.');
          },
          error: (e) => { this.deletingPostId = null; this.toast?.error(e); },
        });
      },
    ).set({ title: this.i18n.t('common.confirm'), movable: false }).set('labels', { ok: this.i18n.t('alertify.ok'), cancel: this.i18n.t('common.cancel') });
  }

  deleteMoment(m: any) {
    if(this.me.lockMomentStatus === 'YES'){
      this.alertService.errorTop((this.i18n.t('cant_delete_moment_error_message')));
      return;
    }
    this.deletePost(m);
  }

  likeSummary(m: any): string {
    const names = (m?.expressions || [])
      .filter((e: any) => e?.firstName || e?.userName)
      .slice(0, 2)
      .map((e: any) => e.firstName || e.userName);
    return names.join(', ');
  }

  visibleComments(m: any): any[] {
    const list = this.rootComments(m);
    return this.viewAllComments[m._id] ? list : list.slice(0, this.commentPreview);
  }

  hiddenCommentCount(m: any): number {
    return Math.max(0, this.rootComments(m).length - this.commentPreview);
  }

  commentUser(c: any): any {
    return c?.createdByFull || { userName: c?.userName, firstName: c?.firstName, lastName: c?.lastName, profilePictureUrl: c?.profilePictureUrl };
  }

  commentUserName(c: any): string {
    const u = this.commentUser(c);
    if (u.firstName) return [u.firstName, u.lastName].filter(Boolean).join(' ');
    return u.userName || '';
  }

  commentAvatar(c: any): string {
    const url = (this.commentUser(c).profilePictureUrl || '').trim();
    return url && url !== 'null' ? url : '';
  }

  commentAvatarText(c: any): string {
    const u = this.commentUser(c);
    const first = (u.firstName || '').trim();
    const last = (u.lastName || '').trim();
    const name = (u.userName || '').trim();
    if (first) return (first.charAt(0) + (last ? last.charAt(0) : '')).toUpperCase();
    return name ? name.replace(/\s+/g, '').slice(0, 2).toUpperCase() : '?';
  }

  commentId(c: any): string {
    return c?.comment_id || c?._id || '';
  }

  isOwnComment(c: any): boolean {
    if (!this.meId) return false;
    const u = this.commentUser(c);
    const id = c?.from || c?.createdBy || UserService.profileId(u);
    return !!id && String(id) === String(this.meId);
  }

  /** Emoji expression cuối cùng (đúng getExpressions(...).slice(-1) của gốc). */
  lastExpression(c: any): string {
    const arr = c?.expressions || [];
    if (!arr.length) return '';
    const e = arr[arr.length - 1];
    return typeof e === 'string' ? e : e?.expressedContent || '👍';
  }

  isLikedComment(c: any): boolean {
    return !!this.likedComments[String(this.meId) + ':' + this.commentId(c)] || (c.expressions || []).some((e: any) => String(e.expressedBy) === String(this.meId));
  }

  likeFeedComment(m: any, c: any, content = '👍'): void {
    const id = this.commentId(c);
    if (!m?._id || !id) return;
    this.reactionFor = null;
    clearTimeout(this.reactionTimer);
    c.expressions = c.expressions || [];
    const mine = c.expressions.find((x: any) => String(x.expressedBy) === String(this.meId));
    let expr: any;
    if (!mine) {
      expr = { expressedBy: this.meId, expression: 'LIKE', expressedAt: new Date(), expressedContent: content };
      c.expressions = [...c.expressions, expr];
    } else if (mine.expressedContent === content) {
      expr = { ...mine };
      c.expressions = c.expressions.filter((x: any) => String(x.expressedBy) !== String(this.meId));
    } else {
      expr = { ...mine, expressedContent: content };
      c.expressions = c.expressions.map((x: any) => (String(x.expressedBy) === String(this.meId) ? expr : x));
    }
    this.momentService.expressComment(m._id, id, expr).subscribe({
      error: (e) => {
        this.toast?.error(e);
      },
    });
  }

  startEditComment(c: any): void {
    this.editingCommentId = this.commentId(c);
    this.editDraft = this.decodeText(c.comment || c.message);
    this.commentMenuId = null;
  }

  cancelEditComment(): void {
    this.editingCommentId = null;
    this.editDraft = '';
  }

  saveEditComment(m: any, c: any): void {
    const text = (this.editDraft || '').trim();
    if (!text || this.savingEdit) return;
    this.savingEdit = true;
    // Payload giống gốc: {comment_id, comment, commentedAt, tags}.
    this.momentService.editComment(m._id, { comment_id: this.commentId(c), comment: text, commentedAt: c.commentedAt }).subscribe({
      next: () => {
        c.comment = text;
        c.message = text;
        this.savingEdit = false;
        this.cancelEditComment();
        this.toast?.success('social.commentSaved', 'Comment saved.');
      },
      error: (e) => { this.savingEdit = false; this.toast?.error(e); },
    });
  }

  deleteFeedComment(m: any, c: any): void {
    this.commentMenuId = null;
    // Payload giống gốc: {comment_id, comment, commentedAt}.
    this.momentService.deleteComment(m._id, { comment_id: this.commentId(c), comment: c.comment || c.message, commentedAt: c.commentedAt }).subscribe({
      next: () => {
        const id = this.commentId(c);
        m.comments = (m.comments || []).filter((x: any) => this.commentId(x) !== id);
        this.toast?.success('social.commentDeleted', 'Comment deleted.');
      },
      error: (e) => this.toast?.error(e),
    });
  }

  authorId(m: any): string {
    const id =
      UserService.profileId(m?.createdByFull) || UserService.profileId(m?.userResponseMoment) || m?.createdBy;
    return id ? String(id) : '';
  }

  isMine(m: any): boolean {
    const id = this.authorId(m);
    return !!id && !!this.meId && id === this.meId;
  }

  audienceKey(m: any): string {
    switch (m?.accessedBy) {
      case 'ALL_FRIENDS':
        return 'social.audFriends';
      case 'ALL_FOLLOWERS':
        return 'social.audFollowers';
      case 'ALL_FRIENDS_AND_FOLLOWERS':
        return 'social.audFriendsFollowers';
      case 'IS_GROUP':
        return 'social.audGroup';
      default:
        return 'social.audPublic';
    }
  }

  /** Ẩn mục Report khi mình đã report bài này rồi (giống showReportMoment gốc). */
  showReportMoment(m: any): boolean {
    return !((m?.reportReasons || []).some((r: any) => String(r.from) === String(this.meId)));
  }

  toggleMenu(m: any): void {
    this.openMenuId = this.openMenuId === m._id ? null : m._id;
  }

  viewAllPosts(m: any): void {
    const id = this.authorId(m);
    this.openMenuId = null;
    if (id) this.router.navigate([], { relativeTo: this.route, queryParams: { userId: id, refresh: true } });
  }

  addFriend(m: any): void {
    // Giống addFriendOnPost gốc: đã bạn bè / đã gửi lời mời thì không gọi lại.
    if (m.friended || m.friendRequested) { this.openMenuId = null; return; }
    const id = this.authorId(m);
    if (!id || this.busyRelation[id]) return;
    this.busyRelation[id] = true;
    this.relationsService.addToFriends(id).subscribe({
      next: () => {
        m.friendRequested = true;
        this.busyRelation[id] = false;
        this.openMenuId = null;
        this.toast?.success('social.friendAdded', 'Friend request sent.');
      },
      error: (e) => { this.busyRelation[id] = false; this.toast?.error(e); },
    });
  }

  toggleFollow(m: any): void {
    const id = this.authorId(m);
    if (!id || this.busyRelation[id]) return;
    this.busyRelation[id] = true;
    const req = m.followed
      ? this.relationsService.unfollowSeller(id)
      : this.relationsService.followSeller(id);
    req.subscribe({
      next: () => {
        m.followed = !m.followed;
        this.busyRelation[id] = false;
        this.openMenuId = null;
        this.toast?.success(m.followed ? 'social.followedMsg' : 'social.unfollowedMsg', m.followed ? 'You are now following.' : 'You unfollowed.');
      },
      error: (e) => { this.busyRelation[id] = false; this.toast?.error(e); },
    });
  }

  momentUrl(m: any): string {
    return `${window.location.origin}/social/moment?postId=${m._id}`;
  }

  // ---------- Forward moment (giống SendChatModal gốc: Individuals + Groups) ----------
  forwardTarget: any = null;
  forwardIndividuals: any[] = [];
  forwardGroups: any[] = [];
  forwardSelected: string[] = [];
  forwardKeyword = '';
  forwardMsg = '';
  forwardLoading = false;
  forwardDone = '';
  fwBroken = new Set<string>();

  /** Nạp danh sách chat gốc và chuẩn hóa mọi schema socket đã dùng ở customerfe. */
  preloadForwardLists(): void {
    if (!this.meId) return;
    this.momentService.getUserChatMenu(this.meId, this.me?.userName || '').subscribe({
      next: (res: any) => {
        const raw = this.forwardResponseList(res);
        const individuals = raw.filter((item: any) => !this.isForwardGroup(item)).map((u: any) => this.normaliseForwardPerson(u)).filter(Boolean);
        const groupsFromMenu = raw.filter((item: any) => this.isForwardGroup(item) && !item?.hide).map((g: any) => this.normaliseForwardGroup(g)).filter(Boolean);
        if (individuals.length) this.forwardIndividuals = individuals;
        else this.preloadForwardIndividualsFallback();
        if (groupsFromMenu.length) this.forwardGroups = groupsFromMenu;
      },
      error: () => this.preloadForwardIndividualsFallback(),
    });
    this.momentService.getGroupsOfUser(this.meId).subscribe({
      next: (res: any) => {
        const groups = this.forwardResponseList(res).filter((g: any) => !g?.hide).map((g: any) => this.normaliseForwardGroup(g)).filter(Boolean);
        if (groups.length) this.forwardGroups = groups;
        else if (!this.forwardGroups.length) this.preloadForwardGroupsFallback();
      },
      error: () => { if (!this.forwardGroups.length) this.preloadForwardGroupsFallback(); },
    });
  }

  private forwardResponseList(res: any): any[] {
    const data = res?.data ?? res;
    if (Array.isArray(data)) return data;
    return data?.list || data?.items || data?.content || [];
  }

  private isForwardGroup(item: any): boolean {
    const value = item?.isGroup;
    return value === true || value === 1 || value === 'true' || value === '1' || item?.type === 'GROUP' || item?.groupType === 'GROUP';
  }

  private normaliseForwardPerson(user: any): any | null {
    const id = user?.id ?? user?.userId ?? user?.customerId ?? user?.customerID;
    if (id == null || String(id) === '') return null;
    const fullName = user?.fullName || user?.displayName || user?.name || user?.customerName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.userName || user?.username || `User ${id}`;
    return { id: String(id), fullName, userName: user?.userName || user?.username || '', firstName: user?.firstName || '', lastName: user?.lastName || '', profilePictureUrl: user?.profilePictureUrl || user?.profileSmallPictureUrl || user?.avatarUrl || user?.avatar || user?.imageUrl || '' };
  }

  private normaliseForwardGroup(group: any): any | null {
    const id = group?._id ?? group?.id ?? group?.groupId;
    if (id == null || String(id) === '') return null;
    const name = group?.name || group?.groupName || group?.displayName || group?.title || `Group ${id}`;
    return { id: String(id), name, fullName: name, profilePictureUrl: group?.profilePictureUrl || group?.profileSmallPictureUrl || group?.avatarUrl || group?.avatar || group?.imageUrl || '' };
  }

  private preloadForwardIndividualsFallback(): void {
    this.userService.getTagRelatives().subscribe({ next: (list: any[]) => this.forwardIndividuals = (list || []).map((u: any) => this.normaliseForwardPerson(u)).filter(Boolean), error: () => {} });
  }

  private preloadForwardGroupsFallback(): void {
    if (!this.meId) return;
    this.momentService.getGroups(this.meId).subscribe({
      next: (res: any) => {
        this.forwardGroups = this.forwardResponseList(res).map((g: any) => this.normaliseForwardGroup(g)).filter(Boolean);
      },
      error: () => {},
    });
  }

  openForward(m: any): void {
    this.forwardTarget = m; this.forwardSelected = []; this.forwardKeyword = ''; this.forwardMsg = ''; this.forwardDone = '';
    this.openMenuId = null;
    if (!this.forwardIndividuals.length || !this.forwardGroups.length) {
      this.forwardLoading = true;
      this.preloadForwardLists();
      setTimeout(() => (this.forwardLoading = false), 1500);
    }
  }

  forwardName(u: any): string {
    return (u?.fullName || u?.name || u?.userName || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || '').trim();
  }

  filteredForwardIndividuals(): any[] {
    const kw = (this.forwardKeyword || '').toLowerCase().trim();
    if (!kw) return this.forwardIndividuals;
    return this.forwardIndividuals.filter((u: any) => this.forwardName(u).toLowerCase().includes(kw));
  }

  filteredForwardGroups(): any[] {
    const kw = (this.forwardKeyword || '').toLowerCase().trim();
    if (!kw) return this.forwardGroups;
    return this.forwardGroups.filter((g: any) => (g.name || '').toLowerCase().includes(kw));
  }

  hasForwards(): boolean {
    return this.forwardSelected.length > 0;
  }

  fwAvatar(u: any): string {
    const url = UserService.avatarUrl(u);
    return url && !this.fwBroken.has(url) ? url : '';
  }

  onFwAvatarError(u: any): void {
    const url = UserService.avatarUrl(u);
    if (url) this.fwBroken.add(url);
  }

  fwInitials(u: any): string {
    const name = this.forwardName(u).replace(/\s+/g, '');
    return (name.slice(0, 2) || '?').toUpperCase();
  }

  toggleForwardUser(id: string): void {
    const key = String(id);
    this.forwardSelected = this.forwardSelected.includes(key)
      ? this.forwardSelected.filter(x => x !== key)
      : [...this.forwardSelected, key];
  }

  /** Template Angular không có global String(), nên chuẩn hóa ID trong component. */
  isForwardSelected(id: any): boolean {
    return this.forwardSelected.includes(String(id));
  }

  /** Không có chat-socket ở momentfe nên forward = chép nội dung + link để gửi (không gọi BE mới). */
  confirmForward(): void {
    if (!this.forwardTarget || !this.forwardSelected.length) return;
    const link = this.momentUrl(this.forwardTarget);
    const text = `${this.decodeText(this.forwardTarget.content || this.forwardTarget.description || '')}\n${link}${this.forwardMsg.trim() ? '\n' + this.forwardMsg.trim() : ''}`;
    const done = () => {
      this.forwardDone = 'social.forwardCopied';
      this.toast?.success('social.forwardCopied', 'Moment copied. Paste it to send to the selected friends.');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => this.legacyCopy(text, done));
    else this.legacyCopy(text, done);
  }

  // ---------- Realtime-lite (polling, không thêm socket dep) ----------

  copyUrl(m: any): void {
    const link = this.momentUrl(m);
    this.openMenuId = null;
    const done = () => {
      this.copiedId = m._id;
      this.toast?.success('social.copied', 'Copied!');
      setTimeout(() => (this.copiedId = null), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(done, () => this.legacyCopy(link, done));
    } else {
      this.legacyCopy(link, done);
    }
  }

  private legacyCopy(text: string, done: () => void): void {
    const box = document.createElement('input');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    box.value = text;
    document.body.appendChild(box);
    box.focus();
    box.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(box);
    done();
  }

  async shareMoment(m: any): Promise<void> {
    const link = this.momentUrl(m);
    this.openMenuId = null;
    const data = { title: this.posterName(m) || 'Bynfor Moment', text: this.decodeText(m.content || m.description), url: link };
    if (navigator.share) {
      try {
        await navigator.share(data);
        this.toast?.success('social.momentShared', 'Moment link ready to share.');
        return;
      } catch {}
    }
    this.copyUrl(m);
  }
}
