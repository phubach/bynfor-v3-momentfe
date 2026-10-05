import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { MomentService } from '../../../services/moment.service';
import { RelationsService } from '../../../services/relations.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { ERelationStatus } from '../../social-video/social-video.model';

@Component({
  selector: 'app-moment-reactions', standalone: false,
  template: `<app-like-list [open]="true" [users]="users" [loading]="loading" [page]="page" [total]="total" [activeTab]="tab" [myUserId]="meId" [expressions]="expressions" (close)="close.emit()" (tabChange)="load(1, $event)" (pageChange)="load($event)" (addFriend)="relationship($event, 'friend')" (cancelFriend)="relationship($event, 'remove')" (follow)="relationship($event, 'follow')" (unfollow)="relationship($event, 'unfollow')"></app-like-list><p class="error" role="alert" *ngIf="error">{{ error | i18next }}</p>`,
  styles: [`.error{position:fixed;z-index:110;bottom:24px;left:50%;transform:translateX(-50%);background:#fff1f1;color:#b3261e;border:1px solid #facccc;border-radius:12px;padding:14px;width:min(500px,90vw)}`],
})
export class MomentReactionsComponent implements OnInit, OnDestroy {
  @Input() moment: any;
  @Input() meId = '';
  @Output() close = new EventEmitter<void>();
  users: any[] = [];
  expressions: Record<string, string> = {};
  loading = false;
  page = 1;
  total = 0;
  tab = 'All';
  error = '';
  private request?: Subscription;
  private relationsRequests = new Subscription();
  private sequence = 0;
  constructor(private moments: MomentService, private relations: RelationsService, private toast: ToastService) {}
  ngOnInit(): void { for (const e of this.moment.expressions || []) this.expressions[String(e.expressedBy)] = e.expressedContent; this.load(); }
  ngOnDestroy(): void { this.sequence++; this.request?.unsubscribe(); this.relationsRequests.unsubscribe(); }
  load(page = 1, tab = this.tab): void {
    this.page = page; this.tab = tab; this.loading = true; this.error = ''; this.request?.unsubscribe();
    const sequence = ++this.sequence;
    const emoji: Record<string, string> = { '+1': '👍', heart: '💖', eyes: '😍', grin: '😀', scream: '😱', sob: '😭', rage: '😡' };
    this.request = this.moments.getCustomerLikeOrDisLike(this.moment._id, page, 10, 'LIKE', emoji[tab] || '').subscribe({
      next: res => { if (sequence !== this.sequence) return; this.users = res?.data?.list || []; this.total = res?.data?.paging?.totalRows || 0; this.loading = false; },
      error: e => { if (sequence !== this.sequence) return; this.loading = false; this.error = e?.error?.message || 'social.loadFailed'; this.toast.error(e); },
    });
  }
  relationship(user: any, action: 'friend' | 'remove' | 'follow' | 'unfollow'): void {
    if (!this.meId || String(user.id) === this.meId || user.busy) return;
    user.busy = true; this.error = '';
    const request = action === 'friend' ? this.relations.addToFriends(user.id) : action === 'remove' ? this.relations.removeFromFriends(user.id, this.meId) : action === 'follow' ? this.relations.followSeller(user.id) : this.relations.unfollowSeller(user.id);
    this.relationsRequests.add(request.subscribe({
      next: () => {
        user.busy = false;
        if (action === 'friend') user.relation = [ERelationStatus.FOLLOW, ERelationStatus.FRIEND_AND_FOLLOW].includes(user.relation) ? ERelationStatus.FRIEND_AND_FOLLOW_REQUEST : ERelationStatus.FRIEND_REQUEST;
        if (action === 'remove') user.relation = user.relation === ERelationStatus.FRIEND_AND_FOLLOW ? ERelationStatus.FOLLOW : ERelationStatus.UNFOLLOWED;
        if (action === 'follow') user.relation = user.relation === ERelationStatus.FRIEND ? ERelationStatus.FRIEND_AND_FOLLOW : user.relation === ERelationStatus.FRIEND_REQUEST ? ERelationStatus.FRIEND_AND_FOLLOW_REQUEST : ERelationStatus.FOLLOW;
        if (action === 'unfollow') user.relation = user.relation === ERelationStatus.FRIEND_AND_FOLLOW ? ERelationStatus.FRIEND : user.relation === ERelationStatus.FRIEND_AND_FOLLOW_REQUEST ? ERelationStatus.FRIEND_REQUEST : ERelationStatus.UNFOLLOWED;
        if (action === 'friend') this.toast.success('social.friendAdded', 'Friend request sent.');
        if (action === 'follow') this.toast.success('social.followedMsg', 'You are now following.');
        if (action === 'unfollow') this.toast.success('social.unfollowedMsg', 'You unfollowed.');
      }, error: e => { user.busy = false; this.error = e?.error?.message || 'social.actionFailed'; this.toast.error(e); },
    }));
  }
}
