import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { MomentService } from '../../../services/moment.service';
import { UserService } from '../../../services/user.service';

interface PendingImage {
  file: File;
  preview: string;
}

interface PendingVideo {
  file: File;
  preview: string;
}
@Component({
  selector: 'app-make-post',
  standalone: false,
  templateUrl: './make-post.component.html',
  styleUrls: ['./make-post.component.scss'],
})
export class MakePostComponent implements OnInit {
  @Output() posted = new EventEmitter<any>();
  @Output() filterChange = new EventEmitter<{ myPost: boolean; friendPost: boolean }>();

  me: any = null;

  content = '';
  postTags: string[] = [];
  images: PendingImage[] = [];
  video: PendingVideo | null = null;
  expanded = false;
  posting = false;
  error = '';
  serverError = '';
  readonly maxImages = 6;

  accessedBy = 'IS_PUBLIC';
  audiences = [
    { value: 'IS_PUBLIC', icon: 'fa-globe', labelKey: 'social.audPublic' },
    { value: 'ALL_FRIENDS', icon: 'fa-user-o', labelKey: 'social.audFriends' },
    { value: 'ALL_FOLLOWERS', icon: 'fa-users', labelKey: 'social.audFollowers' },
    { value: 'ALL_FRIENDS_AND_FOLLOWERS', icon: 'fa-user-plus', labelKey: 'social.audFriendsFollowers' },
  ];

  activeFilter: 'all' | 'friends' | 'mine' = 'all';
  filters = [
    { value: 'all', icon: 'fa-clock-o', labelKey: 'social.filterAll' },
    { value: 'friends', icon: 'fa-users', labelKey: 'social.filterFriends' },
    { value: 'mine', icon: 'fa-bullhorn', labelKey: 'social.filterMine' },
  ];
  openMenu: 'filter' | 'audience' | 'attach' | null = null;
  captureMode: 'photo' | 'video' | null = null;

  constructor(private momentService: MomentService, private userService: UserService, private router: Router) {}

  ngOnInit(): void {
    this.userService.getCurrentUser().subscribe((me) => (this.me = me));
  }

  meAvatarUrl(): string {
    const url = (this.me?.profilePictureUrl || '').trim();
    return url && url !== 'null' ? url : '';
  }

  meAvatarText(): string {
    const first = (this.me?.firstName || '').trim();
    const last = (this.me?.lastName || '').trim();
    const name = (this.me?.userName || '').trim();
    if (first) return (first.charAt(0) + (last ? last.charAt(0) : '')).toUpperCase();
    return name ? name.replace(/\s+/g, '').slice(0, 2).toUpperCase() : '';
  }

  goToMyProfile(e: Event): void {
    e.stopPropagation();
    const id = UserService.profileId(this.me);
    if (id) this.router.navigate(['/social/social-media-profile', id]);
  }

  audienceLabelKey(): string {
    return this.audiences.find((a) => a.value === this.accessedBy)?.labelKey || 'social.audPublic';
  }

  audienceIcon(): string {
    return this.audiences.find((a) => a.value === this.accessedBy)?.icon || 'fa-globe';
  }

  selectAudience(value: string): void {
    this.accessedBy = value;
    this.openMenu = null;
  }

  selectFilter(value: 'all' | 'friends' | 'mine'): void {
    this.activeFilter = value;
    this.openMenu = null;
    this.filterChange.emit({ myPost: value === 'mine', friendPost: value === 'friends' });
  }

  onPickImages(e: Event): void {
    const files = Array.from((e.target as HTMLInputElement).files || []).filter((f) => f.type.startsWith('image/'));
    this.addImageFiles(files);
    (e.target as HTMLInputElement).value = '';
    this.expanded = true;
  }

  onPickVideo(e: Event): void {
    const file = Array.from((e.target as HTMLInputElement).files || []).find((f) => f.type.startsWith('video/'));
    if (file) this.setVideoFile(file);
    (e.target as HTMLInputElement).value = '';
    this.expanded = true;
  }

  /** Mở modal camera thật (giống Take Photo/Video của customerfe). */
  openCapture(mode: 'photo' | 'video'): void {
    this.openMenu = null;
    this.captureMode = mode;
    this.expanded = true;
  }

  /** Nhận file từ modal camera, đưa vào danh sách đính kèm chờ đăng. */
  onCaptured(media: { file: File; preview: string; kind: 'photo' | 'video' }): void {
    this.captureMode = null;
    if (media.kind === 'photo') {
      if (this.images.length < this.maxImages) {
        this.images.push({ file: media.file, preview: media.preview });
      }
    } else {
      this.clearVideo();
      this.video = { file: media.file, preview: media.preview };
    }
    this.expanded = true;
  }

  onUploadMixed(e: Event): void {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    this.addImageFiles(files.filter((f) => f.type.startsWith('image/')));
    const video = files.find((f) => f.type.startsWith('video/'));
    if (video) this.setVideoFile(video);
    (e.target as HTMLInputElement).value = '';
    this.openMenu = null;
    this.expanded = true;
  }

  private addImageFiles(files: File[]): void {
    for (const file of files) {
      if (this.images.length >= this.maxImages) break;
      this.images.push({ file, preview: URL.createObjectURL(file) });
    }
  }

  private setVideoFile(file: File): void {
    this.clearVideo();
    this.video = { file, preview: URL.createObjectURL(file) };
  }

  removeImage(index: number): void {
    const [removed] = this.images.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.preview);
  }

  clearVideo(): void {
    if (this.video) URL.revokeObjectURL(this.video.preview);
    this.video = null;
  }

  canPost(): boolean {
    return !this.posting && (!!this.content.trim() || this.images.length > 0 || !!this.video);
  }

  async submit(): Promise<void> {
    if (!this.canPost()) return;
    this.posting = true;
    this.error = '';
    try {
      const attachments: any[] = [];
      if (this.images.length) {
        const formData = new FormData();
        this.images.forEach((img) => formData.append('uploadfiles', img.file, img.file.name));
        const res: any = await this.momentService.uploadImages(formData).toPromise();
        const uploaded = res?.data || [];
        if (!uploaded.length) throw new Error('upload-image-failed');
        uploaded.forEach((u: any) => {
          attachments.push({ attachmentType: 'IMAGE', attachmentUrl: u.origin, imageUrlSmall: u.small });
        });
      }
      if (this.video) {
        const formData = new FormData();
        formData.append('uploadfiles', this.video.file, this.video.file.name);
        const res: any = await this.momentService.uploadVideos(formData).toPromise();
        const uploaded = res?.data || [];
        if (!uploaded.length) throw new Error('upload-video-failed');
        attachments.push({ attachmentType: 'VIDEO', attachmentUrl: uploaded[0] });
      }
      const res: any = await this.momentService
        .createMoment({ content: this.content.trim(), attachments, accessedBy: this.accessedBy, tags: this.postTags })
        .toPromise();
      if (res?.data) {
        const me = this.me || (await this.userService.getCurrentUser().toPromise().catch(() => null));
        if (me) this.me = me;
        this.posted.emit({
          createdAt: new Date().toISOString(),
          likeCount: 0,
          comments: [],
          ...res.data,
          userResponseMoment: res.data.userResponseMoment || me,
        });
      } else {
        throw new Error(res?.message || 'post-failed');
      }
      this.reset();
    } catch (e: any) {
      this.serverError = e?.error?.message || e?.message || '';
      this.error = 'social.postFailed';
    } finally {
      this.posting = false;
    }
  }

  private reset(): void {
    this.images.forEach((img) => URL.revokeObjectURL(img.preview));
    this.images = [];
    this.clearVideo();
    this.content = '';
    this.postTags = [];
    this.expanded = false;
  }
}
