import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { MomentService } from '../../../services/moment.service';
import { UserService } from '../../../services/user.service';

/**
 * Popup chi tiết video (gọn theo CategoryVideoDetailsComponent của customerfe):
 * video bên trái, sidebar phải gồm tác giả + mô tả + like/comment count +
 * danh sách bình luận (like + reply) + ô nhập bình luận.
 */
@Component({
  selector: 'app-video-detail-popup',
  standalone: false,
  templateUrl: './video-detail-popup.component.html',
  styleUrls: ['./video-detail-popup.component.scss'],
})
export class VideoDetailPopupComponent implements OnChanges {
  @Input() video: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Input() hasPrev = false;
  @Input() hasNext = false;

  comments: any[] = [];
  message = '';
  messageTags: string[] = [];
  sending = false;
  replyTo: string | null = null;
  replyMessage = '';
  replyTags: string[] = [];
  sendingReply = false;
  likingVideo = false;
  likedVideoByMe = false;
  likedComments: { [id: string]: boolean } = {};
  error = '';
  private selectionVersion = 0;
  private meId: string | number | null = null;

  constructor(private momentService: MomentService, private router: Router, private userService: UserService) {
    this.userService.getCurrentUser().subscribe({
      next: (me: any) => (this.meId = UserService.profileId(me) || me?.id || null),
      error: () => {},
    });
  }

  goToProfile(e: Event): void {
    e.stopPropagation();
    const id = UserService.profileId(this.video?.userResponseMoment);
    if (id) {
      this.close.emit();
      this.router.navigate(['/social/social-media-profile', id]);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['video']) {
      this.selectionVersion++;
      this.sending = false;
      this.sendingReply = false;
      this.likingVideo = false;
      this.error = '';
      const v = this.video || {};
      const all = v?.momentComments || v?.comments || [];
      this.comments = all.filter((c: any) => !c.parent_id && !c.parentId);
      this.repliesOfCache = {};
      all
        .filter((c: any) => c.parent_id || c.parentId)
        .forEach((r: any) => {
          const pid = r.parent_id || r.parentId;
          this.repliesOfCache[pid] = [...(this.repliesOfCache[pid] || []), r];
        });
      this.message = '';
      this.messageTags = [];
      this.replyTo = null;
      this.replyMessage = '';
      this.replyTags = [];
      this.likedVideoByMe = false;
      this.likedComments = {};
    }
  }

  private repliesOfCache: { [id: string]: any[] } = {};

  private applyComments(all: any[]): void {
    this.comments = all.filter(c => !c.parent_id && !c.parentId);
    this.repliesOfCache = {};
    all.filter(c => c.parent_id || c.parentId).forEach(c => {
      const parent = c.parent_id || c.parentId;
      this.repliesOfCache[parent] = [...(this.repliesOfCache[parent] || []), c];
    });
    if (this.video) this.video.momentComments = all;
  }

  repliesOf(commentId: string): any[] {
    return this.repliesOfCache[commentId] || [];
  }

  authorName(): string {
    const u = this.video?.userResponseMoment || {};
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
  }

  authorFullName(): string {
    const u = this.video?.userResponseMoment || {};
    return [u.firstName, u.lastName].filter(Boolean).join(' ');
  }

  /** URL avatar, '' khi không có (kể cả 'null'). */
  avatarUrl(u: any): string {
    const url = (u?.profilePictureUrl || '').trim();
    return url && url !== 'null' ? url : '';
  }

  /** Viết tắt tên giống customerfe (UtilsService.abbreviateNameForTemplate). */
  avatarText(u: any): string {
    const firstName = (u?.firstName || '').trim();
    const lastName = (u?.lastName || '').trim();
    if (firstName) {
      return (firstName.charAt(0) + (lastName ? lastName.charAt(0) : '')).toUpperCase();
    }
    const full = (u?.fullName || u?.name || '').trim().replace(/\s+/g, ' ');
    if (full) {
      const parts = full.split(' ');
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return full.replace(/\s+/g, '').slice(0, 2).toUpperCase();
    }
    const userName = (u?.userName || '').trim();
    return userName ? userName.replace(/\s+/g, '').slice(0, 2).toUpperCase() : '';
  }

  /** Giải mã nội dung giống customerfe (UtilsService.decodeUtf8): hết ký tự %... */
  decodeText(s: any): string {
    const str = (s ?? '').toString();
    if (!str) return '';
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  }

  commentUserName(c: any): string {
    const u = c?.createdByFull || {};
    if (u.firstName) return [u.firstName, u.lastName].filter(Boolean).join(' ');
    return (u.fullName || u.name || u.userName || c?.fullName || c?.name || c?.userName || c?.firstName || '').trim();
  }

  toggleVideoLike(): void {
    const v = this.video;
    if (!v?.momentId || this.likingVideo) return;
    const operation = this.likedVideoByMe ? 'REMOVE' : 'ADD';
    this.likingVideo = true;
    const version = this.selectionVersion;
    this.momentService.express(v.momentId, operation as any, 'LIKE', operation === 'ADD' ? '👍' : '').subscribe({
      next: (res: any) => {
        if (version !== this.selectionVersion) return;
        const updated = res?.data || {};
        if (updated.expressions) v.momentLikes = updated.expressions;
        if (updated.likeCount != null) v.likeCount = updated.likeCount;
        this.likedVideoByMe = operation === 'ADD';
        this.likingVideo = false;
      },
      error: e => { if (version === this.selectionVersion) { this.likingVideo = false; this.error = e?.error?.message || 'social.actionFailed'; } },
    });
  }

  likeCount(): number {
    return this.video?.momentLikes?.length ?? this.video?.likeCount ?? 0;
  }

  // ---------- thanh reaction hover (đúng 7 emoji của app-social-moment-emoji gốc) ----------
  readonly reactionEmojis = ['👍', '💖', '😍', '😀', '😱', '😭', '😡'];
  reactionFor: string | null = null;
  private reactionTimer: any = null;

  openReactions(c: any): void {
    clearTimeout(this.reactionTimer);
    this.reactionFor = c.comment_id || c._id;
  }

  scheduleCloseReactions(): void {
    clearTimeout(this.reactionTimer);
    this.reactionTimer = setTimeout(() => (this.reactionFor = null), 250);
  }

  /** Emoji expression cuối cùng (đúng getExpressions(...).slice(-1) của gốc). */
  lastExpression(c: any): string {
    const arr = c?.expressions || [];
    if (!arr.length) return '';
    const e = arr[arr.length - 1];
    return typeof e === 'string' ? e : e?.expressedContent || '👍';
  }

  likeComment(c: any, content = '👍'): void {
    const id = c.comment_id || c._id;
    if (!this.video?.momentId || !id) return;
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
    this.likedComments[id] = c.expressions.some((x: any) => String(x.expressedBy) === String(this.meId));
    this.momentService.expressComment(this.video.momentId, id, expr).subscribe({
      error: () => {
        delete this.likedComments[id];
      },
    });
  }

  openReply(c: any): void {
    const id = c.comment_id || c._id;
    this.replyTo = this.replyTo === id ? null : id;
    this.replyMessage = '';
    this.replyTags = [];
  }

  sendReply(c: any): void {
    const id = c.comment_id || c._id;
    const text = (this.replyMessage || '').trim();
    if (!this.video?.momentId || !id || !text || this.sendingReply) return;
    this.sendingReply = true;
    const version = this.selectionVersion;
    this.error = '';
    this.momentService.addComment(this.video.momentId, text, id, this.replyTags).subscribe({
      next: (res: any) => {
        if (version !== this.selectionVersion) return;
        if (Array.isArray(res?.data?.comments)) this.applyComments(res.data.comments);
        else if (res?.data?.comment_id) this.repliesOfCache[id] = [...(this.repliesOfCache[id] || []), res.data];
        else { this.sendingReply = false; this.error = 'social.actionFailed'; return; }
        this.replyMessage = '';
        this.replyTags = [];
        this.replyTo = null;
        this.sendingReply = false;
      },
      error: e => { if (version === this.selectionVersion) { this.sendingReply = false; this.error = e?.error?.message || 'social.actionFailed'; } },
    });
  }

  sendComment(): void {
    const text = (this.message || '').trim();
    if (!this.video?.momentId || !text || this.sending) return;
    this.sending = true;
    const version = this.selectionVersion;
    this.error = '';
    this.momentService.addComment(this.video.momentId, text, undefined, this.messageTags).subscribe({
      next: (res: any) => {
        if (version !== this.selectionVersion) return;
        if (Array.isArray(res?.data?.comments)) this.applyComments(res.data.comments);
        else if (res?.data?.comment_id) this.comments = [...this.comments, res.data];
        else { this.sending = false; this.error = 'social.actionFailed'; return; }
        this.message = '';
        this.messageTags = [];
        this.sending = false;
      },
      error: e => { if (version === this.selectionVersion) { this.sending = false; this.error = e?.error?.message || 'social.actionFailed'; } },
    });
  }
}
