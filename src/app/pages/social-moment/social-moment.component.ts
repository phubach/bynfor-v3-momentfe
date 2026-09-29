import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MomentService } from '../../services/moment.service';
import { RelationsService } from '../../services/relations.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-social-moment',
  standalone: false,
  templateUrl: './social-moment.component.html',
  styleUrls: ['./social-moment.component.scss'],
})
export class SocialMomentComponent implements OnInit, OnDestroy {
  moments: any[] = [];
  page = 1;
  pageSize = 20;
  loading = false;
  loadingMore = false;
  error = '';
  expandedComments: { [id: string]: boolean } = {};
  commentDrafts: { [id: string]: string } = {};
  sendingComment: { [id: string]: boolean } = {};
  myPost = false;
  friendPost = false;
  filterUserId = '';
  meId = '';
  hasMore = true;
  private scrollHandler: any;
  openMenuId: string | null = null;
  copiedId: string | null = null;
  busyRelation: { [id: string]: boolean } = {};
  private querySub: Subscription | null = null;

  constructor(
    private momentService: MomentService,
    private relationsService: RelationsService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  /** Avatar/tên -> trang profile của user đó (giống customerfe). */
  goToProfile(m: any): void {
    const id = UserService.profileId(m?.createdByFull) || UserService.profileId(m?.userResponseMoment) || m?.createdBy;
    if (id) this.router.navigate(['/social/social-media-profile', id]);
  }

  ngOnInit(): void {
    this.userService.getCurrentUser().subscribe((me: any) => {
      this.meId = UserService.profileId(me);
    });
    // Hỗ trợ permalink ?postId= (từ Copy/Share URL) và lọc ?userId= (từ View All Posts).
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      this.filterUserId = params.get('userId') || '';
      const postId = params.get('postId') || '';
      this.loadFeed(true);
      if (postId) this.pinPost(postId);
    });
    // Cuộn tới đáy thì tự tải thêm (không dùng nút Load more).
    this.scrollHandler = () => {
      const nearBottom = window.innerHeight + window.scrollY + 1000 >= document.body.scrollHeight;
      if (nearBottom && this.hasMore && !this.loading && !this.loadingMore && this.moments.length) {
        this.loadFeed(false);
      }
    };
    window.addEventListener('scroll', this.scrollHandler);
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
    window.removeEventListener('scroll', this.scrollHandler);
  }

  /** Ghim 1 bài cụ thể lên đầu feed khi mở link ?postId=. */
  private pinPost(postId: string): void {
    this.momentService.getWallMoment(postId).subscribe({
      next: (res: any) => {
        const post = res?.data;
        if (post) this.moments = [post, ...this.moments.filter((x) => x._id !== post._id)];
      },
    });
  }

  /** Nhận filter từ nút phễu trên header Make a Post. */
  onFilterChange(f: { myPost: boolean; friendPost: boolean }): void {
    this.myPost = f.myPost;
    this.friendPost = f.friendPost;
    this.loadFeed(true);
  }

  /** Bài vừa đăng xong -> chèn lên đầu feed. */
  onPosted(moment: any): void {
    if (moment) this.moments = [moment, ...this.moments];
  }

  loadFeed(reset = false): void {
    if (reset) {
      this.page = 1;
      this.loading = true;
      this.error = '';
      this.hasMore = true;
    } else {
      if (!this.hasMore) return;
      this.loadingMore = true;
    }
    this.momentService.getWallMoments(this.pageSize, this.page, this.myPost, this.friendPost, this.filterUserId || undefined).subscribe({
      next: (res: any) => {
        const list = res?.data || res || [];
        this.moments = reset ? list : [...this.moments, ...list];
        if (list.length < this.pageSize) this.hasMore = false;
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

  /** Tên hiển thị: first+last, rồi fullName/name, rồi userName. */
  private displayName(u: any): string {
    const full = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
    if (full) return full;
    return (u?.fullName || u?.name || u?.userName || '').trim();
  }

  /** Người đăng: ưu tiên createdByFull như customerfe, rồi tới userResponseMoment. */
  poster(m: any): any {
    return m?.createdByFull || m?.userResponseMoment || {};
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

  /** Giải mã nội dung giống customerfe (decodeUtf8): hết ký tự %... */
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
    return (m?.attachments || []).filter((a: any) => a?.attachmentType !== 'VIDEO' && a?.attachmentUrl);
  }

  videos(m: any): any[] {
    return (m?.attachments || []).filter((a: any) => a?.attachmentType === 'VIDEO' && a?.attachmentUrl);
  }

  toggleLike(m: any): void {
    if (m.liking) return;
    const operation = m.likedByMe ? 'REMOVE' : 'ADD';
    m.liking = true;
    this.momentService.express(m._id, operation as any, 'LIKE', operation === 'ADD' ? '👍' : '').subscribe({
      next: (res: any) => {
        const updated = res?.data || {};
        if (updated.expressions) m.expressions = updated.expressions;
        if (updated.likeCount != null) m.likeCount = updated.likeCount;
        else m.likeCount = Math.max(0, (m.likeCount || 0) + (operation === 'ADD' ? 1 : -1));
        m.likedByMe = operation === 'ADD';
        m.liking = false;
      },
      error: () => {
        m.liking = false;
      },
    });
  }

  toggleComments(m: any): void {
    this.expandedComments[m._id] = !this.expandedComments[m._id];
  }

  sendComment(m: any): void {
    const text = (this.commentDrafts[m._id] || '').trim();
    if (!text || this.sendingComment[m._id]) return;
    this.sendingComment[m._id] = true;
    this.momentService.addComment(m._id, text).subscribe({
      next: (res: any) => {
        m.comments = [...(m.comments || []), res?.data || { comment: text, commentedAt: new Date().toISOString() }];
        this.commentDrafts[m._id] = '';
        this.sendingComment[m._id] = false;
      },
      error: () => {
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

  /** "Abir, MT liked" từ 2 expression đầu (giống firstCustomerLike). */
  likeSummary(m: any): string {
    const names = (m?.expressions || [])
      .filter((e: any) => e?.firstName || e?.userName)
      .slice(0, 2)
      .map((e: any) => e.firstName || e.userName);
    return names.join(', ');
  }

  visibleComments(m: any): any[] {
    const list = m?.comments || [];
    return this.viewAllComments[m._id] ? list : list.slice(0, this.commentPreview);
  }

  hiddenCommentCount(m: any): number {
    return Math.max(0, (m?.comments || []).length - this.commentPreview);
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
    const id = UserService.profileId(u) || c?.from || c?.createdBy;
    return !!id && String(id) === String(this.meId);
  }

  likeFeedComment(m: any, c: any): void {
    const id = this.commentId(c);
    if (!m?._id || !id || this.likedComments[id]) return;
    this.likedComments[id] = true;
    c.expressions = [...(c.expressions || []), '👍'];
    this.momentService.expressComment(m._id, id).subscribe({
      error: () => {
        delete this.likedComments[id];
        c.expressions = (c.expressions || []).slice(0, -1);
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
    this.momentService.editComment(m._id, { ...c, comment: text, editedComment: text }).subscribe({
      next: () => {
        c.comment = text;
        c.message = text;
        this.savingEdit = false;
        this.cancelEditComment();
      },
      error: () => (this.savingEdit = false),
    });
  }

  deleteFeedComment(m: any, c: any): void {
    this.commentMenuId = null;
    this.momentService.deleteComment(m._id, c).subscribe({
      next: () => {
        const id = this.commentId(c);
        m.comments = (m.comments || []).filter((x: any) => this.commentId(x) !== id);
      },
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

  toggleMenu(m: any): void {
    this.openMenuId = this.openMenuId === m._id ? null : m._id;
  }

  viewAllPosts(m: any): void {
    const id = this.authorId(m);
    this.openMenuId = null;
    if (id) this.router.navigate([], { relativeTo: this.route, queryParams: { userId: id } });
  }

  addFriend(m: any): void {
    const id = this.authorId(m);
    if (!id || m.friended || m.friendRequested || this.busyRelation[id]) return;
    this.busyRelation[id] = true;
    this.relationsService.addToFriends(id).subscribe({
      next: () => {
        m.friendRequested = true;
        this.busyRelation[id] = false;
        this.openMenuId = null;
      },
      error: () => (this.busyRelation[id] = false),
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
      },
      error: () => (this.busyRelation[id] = false),
    });
  }

  momentUrl(m: any): string {
    return `${window.location.origin}/social/moment?postId=${m._id}`;
  }

  copyUrl(m: any): void {
    const link = this.momentUrl(m);
    this.openMenuId = null;
    const done = () => {
      this.copiedId = m._id;
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
        return;
      } catch {}
    }
    this.copyUrl(m);
  }
}
