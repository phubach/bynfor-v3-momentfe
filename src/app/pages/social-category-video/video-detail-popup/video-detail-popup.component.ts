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
  sending = false;
  replyTo: string | null = null;
  replyMessage = '';
  sendingReply = false;
  likingVideo = false;
  likedVideoByMe = false;
  likedComments: { [id: string]: boolean } = {};

  constructor(private momentService: MomentService, private router: Router) {}

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
      this.replyTo = null;
      this.replyMessage = '';
      this.likedVideoByMe = false;
      this.likedComments = {};
    }
  }

  private repliesOfCache: { [id: string]: any[] } = {};

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
    const userName = (u?.userName || '').trim();
    if (firstName) {
      return (firstName.charAt(0) + (lastName ? lastName.charAt(0) : '')).toUpperCase();
    }
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
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || c?.userName || c?.firstName || '';
  }

  toggleVideoLike(): void {
    const v = this.video;
    if (!v?.momentId || this.likingVideo) return;
    const operation = this.likedVideoByMe ? 'REMOVE' : 'ADD';
    this.likingVideo = true;
    this.momentService.express(v.momentId, operation as any, 'LIKE', operation === 'ADD' ? '👍' : '').subscribe({
      next: (res: any) => {
        const updated = res?.data || {};
        if (updated.expressions) v.momentLikes = updated.expressions;
        if (updated.likeCount != null) v.likeCount = updated.likeCount;
        this.likedVideoByMe = operation === 'ADD';
        this.likingVideo = false;
      },
      error: () => (this.likingVideo = false),
    });
  }

  likeCount(): number {
    return this.video?.momentLikes?.length ?? this.video?.likeCount ?? 0;
  }

  likeComment(c: any): void {
    const id = c.comment_id || c._id;
    if (!this.video?.momentId || !id || this.likedComments[id]) return;
    this.likedComments[id] = true;
    c.expressions = [...(c.expressions || []), '👍'];
    this.momentService.expressComment(this.video.momentId, id, null).subscribe({
      error: () => {
        delete this.likedComments[id];
        c.expressions = (c.expressions || []).slice(0, -1);
      },
    });
  }

  openReply(c: any): void {
    const id = c.comment_id || c._id;
    this.replyTo = this.replyTo === id ? null : id;
    this.replyMessage = '';
  }

  sendReply(c: any): void {
    const id = c.comment_id || c._id;
    const text = (this.replyMessage || '').trim();
    if (!this.video?.momentId || !id || !text || this.sendingReply) return;
    this.sendingReply = true;
    this.momentService.addComment(this.video.momentId, text, id).subscribe({
      next: (res: any) => {
        const posted = res?.data || { comment: text, commentedAt: new Date().toISOString(), parent_id: id };
        this.repliesOfCache[id] = [...(this.repliesOfCache[id] || []), posted];
        this.replyMessage = '';
        this.replyTo = null;
        this.sendingReply = false;
      },
      error: () => (this.sendingReply = false),
    });
  }

  sendComment(): void {
    const text = (this.message || '').trim();
    if (!this.video?.momentId || !text || this.sending) return;
    this.sending = true;
    this.momentService.addComment(this.video.momentId, text).subscribe({
      next: (res: any) => {
        const posted = res?.data || { comment: text, commentedAt: new Date().toISOString() };
        this.comments = [...this.comments, posted];
        this.message = '';
        this.sending = false;
      },
      error: () => (this.sending = false),
    });
  }
}
