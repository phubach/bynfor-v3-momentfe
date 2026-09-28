import { Component, EventEmitter, Input, Output } from '@angular/core';

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
  @Output() follow = new EventEmitter<any>();
  @Output() unfollow = new EventEmitter<any>();

  label(u: any): string {
    return (u.firstName && u.lastName ? u.firstName + ' ' + u.lastName : u.userName) || '';
  }

  avatar(u: any): string {
    const a = (u.firstName || '').charAt(0) + (u.lastName || '').charAt(0);
    return (a || (u.userName || '?').charAt(0)).toUpperCase();
  }
}
