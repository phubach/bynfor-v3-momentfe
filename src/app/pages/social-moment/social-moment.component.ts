import { Component, OnInit } from '@angular/core';
import { MomentService } from '../../services/moment.service';

@Component({
  selector: 'app-social-moment',
  standalone: false,
  templateUrl: './social-moment.component.html',
  styleUrls: ['./social-moment.component.scss'],
})
export class SocialMomentComponent implements OnInit {
  moments: any[] = [];
  page = 1;
  pageSize = 20;
  loading = false;
  loadingMore = false;
  error = '';
  expandedComments: { [id: string]: boolean } = {};
  commentDrafts: { [id: string]: string } = {};
  sendingComment: { [id: string]: boolean } = {};

  constructor(private momentService: MomentService) {}

  ngOnInit(): void {
    this.loadFeed(true);
  }

  loadFeed(reset = false): void {
    if (reset) {
      this.page = 1;
      this.loading = true;
      this.error = '';
    } else {
      this.loadingMore = true;
    }
    this.momentService.getWallMoments(this.pageSize, this.page).subscribe({
      next: (res: any) => {
        const list = res?.data || res || [];
        this.moments = reset ? list : [...this.moments, ...list];
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

  userName(m: any): string {
    const u = m?.userResponseMoment || {};
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || 'social.unknownUser';
  }

  avatarText(m: any): string {
    const u = m?.userResponseMoment || {};
    const s = (u.firstName || u.userName || '?').trim();
    return (s.charAt(0) || '?').toUpperCase();
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
}
