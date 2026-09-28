import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ERelationStatus } from '../../social-video.model';

/**
 * Modal profile creator (gốc: #idModalMemberProfile + showModalProfile):
 * avatar, tên, thông tin business/location, nút kết bạn + follow theo relationStatus.
 * (QR code + nhắn tin sang live-chat tạm bỏ theo yêu cầu leader: chỉ làm tính năng chính.)
 */
@Component({
  selector: 'app-creator-profile',
  standalone: false,
  templateUrl: './creator-profile.component.html',
  styleUrls: ['./creator-profile.component.scss'],
})
export class CreatorProfileComponent {
  @Input() open = false;
  @Input() profile: any = null;
  @Input() loading = false;
  @Input() relation: any = null;
  @Input() isMine = false;
  @Output() close = new EventEmitter<void>();
  @Output() addFriend = new EventEmitter<void>();
  @Output() cancelRequest = new EventEmitter<void>();
  @Output() acceptRequest = new EventEmitter<void>();
  @Output() removeFriend = new EventEmitter<void>();
  @Output() follow = new EventEmitter<void>();
  @Output() unfollow = new EventEmitter<void>();

  ERelationStatus = ERelationStatus;

  fullName(): string {
    const p = this.profile || {};
    return p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.userName || '';
  }

  avatarText(): string {
    const n = this.fullName() || '?';
    const parts = n.trim().split(/\s+/);
    return ((parts[0]?.charAt(0) || '') + (parts[1]?.charAt(0) || '')).toUpperCase() || '?';
  }

  location(): string {
    const p = this.profile || {};
    return (p.location && p.location.countryName) || p.countryName || p.countryCode || '';
  }

  genderLabel(): string {
    const g = this.profile?.gender;
    if (g === 'M') return 'Male';
    if (g === 'F') return 'Female';
    return '';
  }

  get status(): string {
    return this.relation?.relationStatus || '';
  }

  get statusText(): string {
    return this.relation?.relationStatusText || '';
  }

  get following(): boolean {
    return (this.statusText || '').toLowerCase().includes('following');
  }

  get receivedRequest(): boolean {
    const t = (this.statusText || '').toLowerCase();
    return t.includes('friend request received') || t.includes('received friend request');
  }
}
