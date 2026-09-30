import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MentionInputComponent } from '../../../shared/mention-input/mention-input.component';
import { MomentService } from '../../../services/moment.service';
import { UserService } from '../../../services/user.service';

interface PendingImage {
  file: File;
  preview: string;
}

/**
 * Popup Edit Moment (gọn theo modal Edit Moment của customerfe):
 * feeling/activity, nội dung + emoji + đếm từ + tag @, Tag Someone,
 * audience, giữ/xóa ảnh-video cũ, thêm mới, nhập Video URL, Cancel/Update.
 */
@Component({
  selector: 'app-edit-moment-popup',
  standalone: false,
  templateUrl: './edit-moment-popup.component.html',
  styleUrls: ['./edit-moment-popup.component.scss'],
})
export class EditMomentPopupComponent implements OnInit {
  @Input() moment: any = null;
  @Output() saved = new EventEmitter<any>();
  @Output() closed = new EventEmitter<void>();
  @ViewChild('contentBox', { static: false }) contentBox?: MentionInputComponent;

  content = '';
  tags: string[] = [];
  activities: any[] = [];
  selectedActivity: any = null;
  selectedSubActivity = '';
  fullName = '';
  storeName = '';
  nameDisplayGift = '';
  accessedBy = 'IS_PUBLIC';
  audiences = [
    { value: 'IS_PUBLIC', labelKey: 'social.audPublic' },
    { value: 'ALL_FRIENDS', labelKey: 'social.audFriends' },
    { value: 'ALL_FOLLOWERS', labelKey: 'social.audFollowers' },
    { value: 'ALL_FRIENDS_AND_FOLLOWERS', labelKey: 'social.audFriendsFollowers' },
  ];
  keptAttachments: any[] = [];
  newImages: PendingImage[] = [];
  newVideo: { file: File; preview: string } | null = null;
  videoUrl = '';
  saving = false;
  error = '';
  readonly maxImages = 6;
  readonly maxWords = 120;

  constructor(private momentService: MomentService, private userService: UserService) {}

  ngOnInit(): void {
    const m = this.moment || {};
    const raw = m.content || m.description || '';
    try {
      this.content = decodeURIComponent(raw);
    } catch {
      this.content = raw;
    }
    this.tags = [...(m.tags || [])];
    this.accessedBy = m.accessedBy || 'IS_PUBLIC';
    this.keptAttachments = [...(m.attachments || [])];
    this.nameDisplayGift = m.nameDisplayGift || '';
    // Tên hiển thị: tên cá nhân + tên store (giống create-moment của customerfe).
    this.userService.getCurrentUser().subscribe((me: any) => {
      if (!me) return;
      this.fullName = [me.firstName, me.lastName].filter(Boolean).join(' ') || me.userName || '';
      if (!this.nameDisplayGift) this.nameDisplayGift = this.fullName;
      const meId = UserService.profileId(me);
      if (meId) {
        this.userService.getStoreByOwner(meId).subscribe({
          next: (res: any) => {
            const store = res?.data || res;
            this.storeName = store?.name || store?.storeName || '';
          },
        });
      }
    });
    this.momentService.getListOfActivities().subscribe({
      next: (res: any) => {
        const list = (res?.data || []).filter((a: any) => (a?.subActivities || []).length);
        list.unshift({ name: 'No Feeling/Activity', subActivities: [] });
        this.activities = list;
        // Preselect theo bài đang sửa (giống create-moment dòng 484-485).
        this.selectedActivity =
          this.activities.find((a: any) => a.name === m.activity) || this.activities[0];
        this.selectedSubActivity = m.subActivity || '';
      },
    });
  }

  /** Đổi activity -> sub-activity mặc định về đầu danh sách (giống activitySelected). */
  onActivityChange(): void {
    const subs = this.selectedActivity?.subActivities || [];
    this.selectedSubActivity = subs.length ? subs[0].text : '';
  }

  wordsLeft(): number {
    const n = this.content.trim() ? this.content.trim().split(/\s+/).length : 0;
    return this.maxWords - n;
  }

  tagSomeone(): void {
    if (!this.content.endsWith('@') && !this.content.endsWith(' ')) this.content += ' ';
    if (!this.content.endsWith('@')) this.content += '@';
    this.contentBox?.focus();
  }

  removeKept(index: number): void {
    this.keptAttachments.splice(index, 1);
  }

  isVideoAttachment(a: any): boolean {
    return a?.attachmentType === 'VIDEO';
  }

  onPickImages(e: Event): void {
    const files = Array.from((e.target as HTMLInputElement).files || []).filter((f) => f.type.startsWith('image/'));
    const slots = this.maxImages - this.keptAttachments.filter((a) => !this.isVideoAttachment(a)).length - this.newImages.length;
    files.slice(0, Math.max(0, slots)).forEach((file) => {
      this.newImages.push({ file, preview: URL.createObjectURL(file) });
    });
    (e.target as HTMLInputElement).value = '';
  }

  onPickMixed(e: Event): void {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    const imgSlots = this.maxImages - this.keptAttachments.filter((a) => !this.isVideoAttachment(a)).length - this.newImages.length;
    files
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, Math.max(0, imgSlots))
      .forEach((file) => this.newImages.push({ file, preview: URL.createObjectURL(file) }));
    const video = files.find((f) => f.type.startsWith('video/'));
    if (video) {
      if (this.newVideo) URL.revokeObjectURL(this.newVideo.preview);
      this.newVideo = { file: video, preview: URL.createObjectURL(video) };
    }
    (e.target as HTMLInputElement).value = '';
  }

  removeNewImage(index: number): void {
    const [removed] = this.newImages.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.preview);
  }

  clearNewVideo(): void {
    if (this.newVideo) URL.revokeObjectURL(this.newVideo.preview);
    this.newVideo = null;
  }

  addVideoUrl(): void {
    const url = (this.videoUrl || '').trim();
    if (!url) return;
    this.keptAttachments.push({ attachmentType: 'VIDEO', attachmentUrl: url });
    this.videoUrl = '';
  }

  canSave(): boolean {
    return !this.saving && !!this.content.trim() && this.wordsLeft() >= 0;
  }

  close(): void {
    this.newImages.forEach((img) => URL.revokeObjectURL(img.preview));
    this.clearNewVideo();
    this.closed.emit();
  }

  async save(): Promise<void> {
    if (!this.canSave() || !this.moment) return;
    this.saving = true;
    this.error = '';
    try {
      const attachments = [...this.keptAttachments];
      if (this.newImages.length) {
        const formData = new FormData();
        this.newImages.forEach((img) => formData.append('uploadfiles', img.file, img.file.name));
        const res: any = await this.momentService.uploadImages(formData).toPromise();
        const uploaded = res?.data || [];
        if (!uploaded.length) throw new Error('upload-image-failed');
        uploaded.forEach((u: any) => {
          attachments.push({ attachmentType: 'IMAGE', attachmentUrl: u.origin, imageUrlSmall: u.small });
        });
      }
      if (this.newVideo) {
        const formData = new FormData();
        formData.append('uploadfiles', this.newVideo.file, this.newVideo.file.name);
        const res: any = await this.momentService.uploadVideos(formData).toPromise();
        const uploaded = res?.data || [];
        if (!uploaded.length) throw new Error('upload-video-failed');
        attachments.push({ attachmentType: 'VIDEO', attachmentUrl: uploaded[0] });
      }
      const body = {
        ...this.moment,
        content: this.content.trim(),
        description: this.content.trim(),
        activity: this.selectedActivity?.name || undefined,
        subActivity: this.selectedSubActivity || undefined,
        nameDisplayGift: this.nameDisplayGift || undefined,
        accessedBy: this.accessedBy,
        tags: this.tags,
        attachments,
      };
      const res: any = await this.momentService.updateMoment(body).toPromise();
      this.saved.emit(res?.data || body);
      this.close();
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'social.postFailed';
      this.saving = false;
    }
  }
}
