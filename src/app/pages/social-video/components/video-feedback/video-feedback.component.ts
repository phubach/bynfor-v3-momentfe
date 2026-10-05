import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { MomentService } from '../../../../services/moment.service';
import { UserService } from '../../../../services/user.service';

@Component({
  selector: 'app-video-feedback', standalone: false,
  templateUrl: './video-feedback.component.html', styleUrls: ['./video-feedback.component.scss'],
})
export class VideoFeedbackComponent implements OnInit, OnDestroy {
  @Input() video: any = null;
  @Output() close = new EventEmitter<void>();
  me: any = null;
  tab: 'MAIN' | 'TARGET' = 'MAIN';
  items: any[] = [];
  loading = false;
  sending = false;
  draft = '';
  replyTo: any = null;
  error = '';
  success = false;
  page = 1;
  private subscriptions = new Subscription();
  private listRequest?: Subscription;
  private sequence = 0;
  constructor(private moments: MomentService, private users: UserService) {}
  ngOnInit(): void { this.subscriptions.add(this.users.getCurrentUser().subscribe(me => { this.me = me; this.load(); })); }
  ngOnDestroy(): void { this.sequence++; this.listRequest?.unsubscribe(); this.subscriptions.unsubscribe(); }
  load(tab = this.tab): void {
    const id = UserService.profileId(this.me);
    if (!id) { this.error = 'social.profileRequired'; return; }
    this.tab = tab; this.page = 1; this.loading = true; this.error = ''; this.listRequest?.unsubscribe();
    const sequence = ++this.sequence;
    this.listRequest = this.moments.getVideoFeedbacks(id, tab).subscribe({
      next: res => { if (sequence !== this.sequence) return; this.items = res?.data?.list || []; this.loading = false; },
      error: e => { if (sequence !== this.sequence) return; this.loading = false; this.error = e?.error?.message || 'social.loadFailed'; },
    });
  }
  visible(): any[] { return this.items.slice((this.page - 1) * 10, this.page * 10); }
  targetId(): string { return UserService.profileId(this.video?.userResponseMoment || this.video?.createdByFull); }
  canSend(): boolean { return !this.sending && !!this.draft.trim() && !!UserService.profileId(this.me) && (!!this.replyTo || (!!this.video?.id && !!this.targetId())); }
  send(): void {
    if (!this.canSend()) return;
    const userId = UserService.profileId(this.me);
    const replying = !!this.replyTo;
    const target = this.targetId();
    const body = replying
      ? { parentId: this.replyTo._id, message: this.draft.trim(), createdBy: Number(userId) }
      : { message: this.draft.trim(), mainId: Number(target), targetId: Number(userId), videoId: this.video.id, videoUrl: this.video.attachmentUrl };
    this.sending = true; this.success = false; this.error = '';
    this.subscriptions.add(this.moments.createVideoFeedback(body).subscribe({
      next: () => {
        this.sending = false; this.draft = ''; this.replyTo = null; this.success = true; this.load();
        if (!replying && target !== userId) {
          const name = [this.me?.firstName, this.me?.lastName].filter(Boolean).join(' ') || this.me?.userName || '';
          this.subscriptions.add(this.moments.notifyVideoFeedback(target, name).subscribe({ error: () => { this.error = 'social.feedbackNotificationFailed'; } }));
        }
      }, error: e => { this.sending = false; this.error = e?.error?.message || 'social.actionFailed'; },
    }));
  }
}
