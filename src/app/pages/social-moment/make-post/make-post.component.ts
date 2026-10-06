import { Component, EventEmitter, OnInit, Output, OnDestroy, Inject } from '@angular/core';
import { I18NEXT_SERVICE, ITranslationService } from 'angular-i18next';
import { Router } from '@angular/router';
import { MomentService } from '../../../services/moment.service';
import { TagUser, UserService } from '../../../services/user.service';
import { ToastService } from '../../../shared/toast/toast.service';

declare let alertify: any;

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
export class MakePostComponent implements OnInit, OnDestroy {
  @Output() posted = new EventEmitter<any>();
  @Output() filterChange = new EventEmitter<{ myPost: boolean; friendPost: boolean; topPost?: boolean; reported?: boolean; hidden?: boolean; store?: boolean }>();

  me: any = null;

  giftEnabled = false;
  giftWallet: 'skill' | 'monetary' | 'earnings' = 'skill';
  giftAmount = 0;
  giftQuantity = 1;
  giftTitle = '';
  giftName = '';
  giftBalance(): number { return Number(this.giftWallet === 'skill' ? this.me?.wallet : this.giftWallet === 'monetary' ? this.me?.depositMoney : this.me?.orderMoneyAvailable) || 0; }
  giftValid(): boolean { return !this.giftEnabled || (!!this.giftTitle.trim() && !!this.giftName.trim() && Number.isInteger(this.giftQuantity) && this.giftQuantity >= 1 && Number.isFinite(this.giftAmount) && this.giftAmount >= this.giftQuantity * .01 && this.giftAmount <= Math.min(500, this.giftBalance()) && Number(this.giftAmount.toFixed(2)) === this.giftAmount); }
  selectedPeople: TagUser[] = [];
  activities: any[] = [];
  selectedActivity: any = null;
  subActivity = '';
  categories: any[] = [];
  categoryId = '';
  videoDescription = '';
  videoUrl = '';
  wordsLeft(): number { return 120 - (this.content.trim() ? this.content.trim().split(/\s+/).length : 0); }
  onActivityChange(): void { this.subActivity = this.selectedActivity?.subActivities?.[0]?.text || ''; }
  /** Chọn @ trong nội dung phải hiện đồng thời tại Tag Someone và đi vào payload tagUsers. */
  addMentionedPerson(user: TagUser): void {
    if (!user?.id || this.selectedPeople.some(person => String(person.id) === String(user.id))) return;
    this.selectedPeople = [...this.selectedPeople, user];
  }
  ngOnDestroy(): void { this.images.forEach(image => URL.revokeObjectURL(image.preview)); this.clearVideo(); }
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
    { value: 'IS_GROUP', icon: 'fa-users', labelKey: 'social.audGroup' },
  ];
  groups: any[] = [];
  groupId = '';

  activeFilter: 'all' | 'friends' | 'mine' | 'top' | 'reported' | 'hidden' | 'store' = 'all';
  filters = [
    { value: 'all', icon: 'fa-clock-o', labelKey: 'social.filterAll' },
    { value: 'friends', icon: 'fa-users', labelKey: 'social.filterFriends' },
    { value: 'top', icon: 'fa-trophy', labelKey: 'social.filterTop' },
    { value: 'reported', icon: 'fa-flag-o', labelKey: 'social.filterReported' },
    { value: 'mine', icon: 'fa-bullhorn', labelKey: 'social.filterMine' },
    { value: 'hidden', icon: 'fa-eye-slash', labelKey: 'social.filterHidden' },
    { value: 'store', icon: 'fa-shopping-bag', labelKey: 'social.filterStore' },
  ];
  openMenu: 'filter' | 'audience' | 'attach' | null = null;
  captureMode: 'photo' | 'video' | null = null;

  constructor(private momentService: MomentService, private userService: UserService, private router: Router, private toast: ToastService, @Inject(I18NEXT_SERVICE) private i18n: ITranslationService) {}

  ngOnInit(): void {
    this.userService.getCurrentUser().subscribe((me) => {
      this.me = me; this.giftName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.userName || '';
      const meId = UserService.profileId(me);
      if (meId) this.momentService.getGroups(meId).subscribe({ next: (res: any) => this.groups = res?.data || res?.data?.list || [], error: () => {} });
    });
    this.momentService.getVideoCategories().subscribe({ next: res => this.categories = res?.data || [], error: () => {} });
    this.momentService.getListOfActivities().subscribe({ next: res => {
      this.activities = res?.data || [];
    }, error: () => {} });
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
    if (value !== 'IS_GROUP') this.groupId = '';
    this.openMenu = null;
  }

  selectFilter(value: 'all' | 'friends' | 'mine' | 'top' | 'reported' | 'hidden' | 'store'): void {
    this.activeFilter = value;
    this.openMenu = null;
    this.filterChange.emit({ myPost: value === 'mine', friendPost: value === 'friends', topPost: value === 'top', reported: value === 'reported', hidden: value === 'hidden', store: value === 'store' ? true : value === 'all' ? false : undefined });
  }

  /** Link preview gọn (giống NgxLinkPreview gốc): lấy URL đầu tiên trong nội dung. */
  firstLink(): string {
    const m = (this.content || '').match(/https?:\/\/[^\s<>]+/i);
    return m ? m[0] : '';
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
      // GIF giữ nguyên như gốc (image-blob-reduce bỏ qua GIF).
      if (file.type === 'image/gif') { this.images.push({ file, preview: URL.createObjectURL(file) }); continue; }
      this.downscaleImage(file).then(d => this.images.push(d)).catch(() => this.images.push({ file, preview: URL.createObjectURL(file) }));
    }
  }

  /** Nén ảnh về max 1200px qua canvas (thay image-blob-reduce, không thêm lib). */
  private downscaleImage(file: File, maxDim = 1200): Promise<PendingImage> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          if (scale >= 1) { resolve({ file, preview: url }); return; }
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(b => {
            URL.revokeObjectURL(url);
            if (!b) { reject(new Error('resize-failed')); return; }
            const f = new File([b], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
            resolve({ file: f, preview: URL.createObjectURL(f) });
          }, 'image/jpeg', 0.85);
        } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load-failed')); };
      img.src = url;
    });
  }

  private setVideoFile(file: File): void {
    // Giống gốc: video thường max 10MB.
    if (file.size > 10 * 1024 * 1024) { this.error = 'social.videoTooLarge'; return; }
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
    if (this.posting || !this.me || this.wordsLeft() < 0 || !this.giftValid()) return false;
    if (this.accessedBy === 'IS_GROUP' && !this.groupId) return false;
    return (this.giftEnabled || !!this.subActivity || !!this.content.trim() || this.images.length > 0 || !!this.video || /^https?:\/\//i.test(this.videoUrl.trim()));
  }

  async submit(giftConfirmed = false): Promise<void> {
    if (!this.canPost()) return;
    if (this.me?.status === 'MUTE_MOMENT') { this.error = 'your_account_is_not_allowed_to_post_moments_due_to_some_behavior'; return; }
    if (this.videoUrl.trim() && !/^https?:\/\//i.test(this.videoUrl.trim())) { this.error = 'social.invalidVideoUrl'; return; }
    if (this.giftEnabled && !giftConfirmed) {
      alertify.confirm(
        this.i18n.t('social.confirmGift', { amount: this.giftAmount }),
        (ok: boolean) => { if (ok) this.submit(true); },
      ).set({ title: this.i18n.t('social.shareGift'), movable: false }).set('labels', { ok: this.i18n.t('alertify.ok'), cancel: this.i18n.t('common.cancel') });
      return;
    }
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
        attachments.push({ attachmentType: 'VIDEO', attachmentUrl: uploaded[0], categoryId: this.categoryId || undefined, description: this.videoDescription.trim() });
      }
      const res: any = await this.momentService
        .createMoment({ content: this.content.trim(), attachments: [...attachments, ...(this.videoUrl.trim() ? [{ attachmentType: 'VIDEO', attachmentUrl: this.videoUrl.trim(), categoryId: this.categoryId || undefined, description: this.videoDescription.trim() }] : [])], accessedBy: this.accessedBy,
          tags: [...new Set([...this.postTags, ...this.selectedPeople.map(u => u.id)])],
          tagUsers: this.selectedPeople, taggers: this.selectedPeople.map(u => ({ ...u, name: u.fullName })), taggerIds: this.selectedPeople.map(u => u.id),
          activity: this.selectedActivity?.name, subActivity: this.subActivity,
          gift: this.giftEnabled ? { shareMoney: this.giftAmount, quantityWallet: this.giftQuantity, bynforTitle: this.giftTitle.trim(), nameDisplayGift: this.giftName.trim(), isEarnedSkillRewards: this.giftWallet === 'skill', isMonetaryPoints: this.giftWallet === 'monetary', isEarnings: this.giftWallet === 'earnings' } : undefined,
          ...(this.accessedBy === 'IS_GROUP' && this.groupId ? { groupId: this.groupId } : {}) })
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
        this.toast.success('social.postPublished', 'Moment published.');
      } else {
        throw new Error(res?.message || 'post-failed');
      }
      this.userService.resetSessionCache();
      this.userService.getCurrentUser().subscribe(me => { if (me) this.me = me; });
      this.reset();
    } catch (e: any) {
      this.serverError = e?.error?.message || e?.message || '';
      this.error = 'social.postFailed';
      this.toast.error(e);
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
    this.giftEnabled = false; this.giftAmount = 0; this.giftQuantity = 1; this.giftTitle = '';
    this.selectedPeople = []; this.selectedActivity = null; this.subActivity = ''; this.categoryId = ''; this.videoDescription = ''; this.videoUrl = '';
    this.expanded = false;
  }
}
