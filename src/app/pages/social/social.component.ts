import { Component, HostListener, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-social',
  standalone: false,
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.scss'],
})
export class SocialComponent implements OnInit {
  profile: any = null;
  connected = navigator.onLine;
  avatarFailed = false;
  avatarOriginalFallback = false;

  constructor(private auth: AuthService, private users: UserService) {}

  ngOnInit(): void {
    this.users.getCurrentUser().subscribe(profile => {
      this.profile = profile;
      this.avatarFailed = false;
      this.avatarOriginalFallback = false;
    });
  }

  get displayName(): string {
    return [this.profile?.firstName, this.profile?.lastName].filter(Boolean).join(' ')
      || this.profile?.userName || 'Bynfor';
  }

  get initials(): string {
    return this.displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  get avatarUrl(): string {
    if (!this.profile) return '';
    // Hết ảnh thật (giống chatfe dùng default-user.jpg) thì hiện ảnh mặc định,
    // chỉ còn initials khi chưa load xong profile.
    if (this.avatarFailed) return UserService.DEFAULT_AVATAR;
    return UserService.avatarUrl(this.profile, this.avatarOriginalFallback) || UserService.DEFAULT_AVATAR;
  }

  onAvatarError(): void {
    if (!this.avatarOriginalFallback && this.avatarUrl !== UserService.avatarUrl(this.profile, true)) {
      this.avatarOriginalFallback = true;
    } else {
      this.avatarFailed = true;
    }
  }

  get profileLink(): string {
    const id = UserService.profileId(this.profile);
    return id ? `/social/social-media-profile/${id}` : '/social/moment';
  }

  @HostListener('window:online')
  @HostListener('window:offline')
  updateConnection(): void {
    const was = this.connected;
    this.connected = navigator.onLine;
    // Mạng rớt làm ảnh lỗi rồi dính initials vĩnh viễn -> online lại thì thử tải lại ảnh.
    if (!was && this.connected) {
      this.avatarFailed = false;
      this.avatarOriginalFallback = false;
    }
  }

  logout(): void {
    this.auth.logout(true);
  }
}
