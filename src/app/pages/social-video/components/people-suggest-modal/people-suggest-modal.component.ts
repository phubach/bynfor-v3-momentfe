import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ERelationStatus } from '../../social-video.model';

/**
 * Modal "People who you may know" (gốc: #idModalPeople trong tiktok.component.html).
 * Tự bật khi vào trang video nếu user chưa chọn "Do Not Display Again".
 * Mỗi card: avatar/tên + nút kết bạn + nút follow.
 * (Nút nhắn tin sang live-chat tạm bỏ theo yêu cầu leader: chỉ làm tính năng chính.)
 */
@Component({
  selector: 'app-people-suggest-modal',
  standalone: false,
  templateUrl: './people-suggest-modal.component.html',
  styleUrls: ['./people-suggest-modal.component.scss'],
})
export class PeopleSuggestModalComponent {
  @Input() open = false;
  @Input() people: any[] = [];
  @Input() loading = false;

  @Output() viewMore = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();
  @Output() doNotShowAgain = new EventEmitter<void>();
  @Output() addFriend = new EventEmitter<any>();
  @Output() removeFriend = new EventEmitter<any>();
  @Output() cancelRequest = new EventEmitter<any>();
  @Output() acceptRequest = new EventEmitter<any>();
  @Output() rejectRequest = new EventEmitter<any>();
  @Output() follow = new EventEmitter<any>();
  @Output() unfollow = new EventEmitter<any>();

  ERelationStatus = ERelationStatus;

  displayName(u: any): string {
    return (u.firstName && u.lastName ? u.firstName + ' ' + u.lastName : u.userName) || '';
  }

  initials(u: any): string {
    const a = ((u.firstName || '').charAt(0) + (u.lastName || '').charAt(0)).toUpperCase();
    return a || ((u.userName || '?').charAt(0)).toUpperCase();
  }

  hasAvatar(u: any): boolean {
    return !!u.profilePictureUrl && u.profilePictureUrl !== 'null' && !u.error;
  }

  /** Đã nhận lời mời kết bạn từ người này -> hiện Accept/Reject. */
  isReceivedRequest(u: any): boolean {
    return (
      (u.relationStatus === ERelationStatus.FRIEND_REQUEST && u.relationStatusText === 'Friend request received') ||
      (u.relationStatus === ERelationStatus.FOLLOW && u.relationStatusText === 'You are following and received friend request') ||
      (u.relationStatus === ERelationStatus.FRIEND_AND_FOLLOW_REQUEST &&
        u.relationStatusText === 'You are being followed and received friend request')
    );
  }

  /** Đã gửi lời mời (chờ trả lời) -> hiện Cancel. */
  isSentRequest(u: any): boolean {
    if (this.isReceivedRequest(u)) return false;
    return (
      u.relationStatus === ERelationStatus.FRIEND_REQUEST || u.relationStatus === ERelationStatus.FRIEND_AND_FOLLOW_REQUEST
    );
  }

  isFriend(u: any): boolean {
    return u.relationStatus === ERelationStatus.FRIEND || u.relationStatus === ERelationStatus.FRIEND_AND_FOLLOW;
  }

  canAddFriend(u: any): boolean {
    return (
      !this.isFriend(u) &&
      !this.isSentRequest(u) &&
      !this.isReceivedRequest(u) &&
      u.relationStatus !== ERelationStatus.BLOCKED &&
      !(u.relationStatus === ERelationStatus.FOLLOW && u.relationStatusText === 'You are following and received friend request')
    );
  }

  isFollowing(u: any): boolean {
    return (
      (u.relationStatus === ERelationStatus.FRIEND_AND_FOLLOW_REQUEST &&
        u.relationStatusText !== 'You are being followed and received friend request') ||
      (u.relationStatus === ERelationStatus.FOLLOW && u.relationStatusText !== 'You are being followed') ||
      u.relationStatus === ERelationStatus.FRIEND_AND_FOLLOW
    );
  }

  canFollow(u: any): boolean {
    return !this.isFollowing(u) && u.relationStatus !== ERelationStatus.BLOCKED;
  }
}
