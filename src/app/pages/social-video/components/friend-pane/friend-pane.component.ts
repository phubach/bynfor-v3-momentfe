import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UserService } from '../../../../services/user.service';

/** Tab FRIEND: danh sách bạn + follow/unfollow (gốc: video-friend.component). */
@Component({
  selector: 'app-friend-pane',
  standalone: false,
  templateUrl: './friend-pane.component.html',
  styleUrls: ['./friend-pane.component.scss'],
})
export class FriendPaneComponent {
  @Input() friends: any[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Output() retry = new EventEmitter<void>();
  @Output() follow = new EventEmitter<any>();
  @Output() unfollow = new EventEmitter<any>();

  label(u: any): string {
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.userName || u?.fullName || '';
  }

  avatar(u: any): string {
    const a = (u?.firstName || '').charAt(0) + (u?.lastName || '').charAt(0);
    return (a || (u?.userName || '?').charAt(0)).toUpperCase();
  }

  avatarUrl(user: any): string {
    return user.avatarFailed ? '' : UserService.avatarUrl(user, !!user.avatarOriginalFallback);
  }

  onAvatarError(user: any): void {
    if (!user.avatarOriginalFallback && this.avatarUrl(user) !== UserService.avatarUrl(user, true)) {
      user.avatarOriginalFallback = true;
    } else {
      user.avatarFailed = true;
    }
  }
}
