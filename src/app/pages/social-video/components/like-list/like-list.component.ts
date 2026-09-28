import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ERelationStatus } from '../../social-video.model';

/**
 * Modal xem ai đã like (gốc: #idModalLikeAndDislike + handleViewLikeDislike):
 * tabs emoji (All/👍/💖/...) + tab Comment, phân trang, badge verified,
 * nút kết bạn / follow-unfollow từng người.
 */
@Component({
  selector: 'app-like-list',
  standalone: false,
  templateUrl: './like-list.component.html',
  styleUrls: ['./like-list.component.scss'],
})
export class LikeListComponent {
  @Input() open = false;
  @Input() users: any[] = [];
  @Input() loading = false;
  @Input() page = 1;
  @Input() total = 0;
  @Input() pageSize = 10;
  @Input() activeTab = 'All';
  @Input() commentCount = 0;
  @Input() myUserId: number | string | null = null;
  /** expressedBy -> emoji đã react (để hiện cạnh tên). */
  @Input() expressions: Record<string, string> = {};
  /** id user đã comment (để hiện icon + lọc tab Comment). */
  @Input() commentedIds: Record<string, boolean> = {};

  @Output() close = new EventEmitter<void>();
  @Output() tabChange = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() addFriend = new EventEmitter<any>();
  @Output() cancelFriend = new EventEmitter<any>();
  @Output() follow = new EventEmitter<any>();
  @Output() unfollow = new EventEmitter<any>();

  ERelationStatus = ERelationStatus;

  tabs = [
    { id: 'All', native: 'All' },
    { id: '+1', native: '👍' },
    { id: 'heart', native: '💖' },
    { id: 'eyes', native: '😍' },
    { id: 'grin', native: '😀' },
    { id: 'scream', native: '😱' },
    { id: 'sob', native: '😭' },
    { id: 'rage', native: '😡' },
  ];

  label(u: any): string {
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
  }

  isMe(u: any): boolean {
    return this.myUserId != null && String(u.id) === String(this.myUserId);
  }

  isFriend(u: any): boolean {
    return u.relation === ERelationStatus.FRIEND || u.relation === ERelationStatus.FRIEND_AND_FOLLOW;
  }

  isRequested(u: any): boolean {
    return u.relation === ERelationStatus.FRIEND_REQUEST || u.relation === ERelationStatus.FRIEND_AND_FOLLOW_REQUEST;
  }

  canAddFriend(u: any): boolean {
    return !this.isFriend(u) && !this.isRequested(u);
  }

  isFollowing(u: any): boolean {
    return (
      u.relation === ERelationStatus.FRIEND_AND_FOLLOW_REQUEST ||
      u.relation === ERelationStatus.FOLLOW ||
      u.relation === ERelationStatus.FRIEND_AND_FOLLOW
    );
  }

  canFollow(u: any): boolean {
    return (
      u.relation !== ERelationStatus.FRIEND_AND_FOLLOW_REQUEST &&
      u.relation !== ERelationStatus.FOLLOW &&
      u.relation !== ERelationStatus.FRIEND_AND_FOLLOW
    );
  }

  totalPages(): number {
    return Math.max(1, Math.ceil((this.total || 0) / (this.pageSize || 10)));
  }
}
