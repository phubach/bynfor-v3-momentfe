import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MomentService } from '../../../services/moment.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-moment-rewards', standalone: false,
  templateUrl: './moment-rewards.component.html', styleUrls: ['./moment-rewards.component.scss'],
})
export class MomentRewardsComponent implements OnInit, OnDestroy {
  fund: any = null;
  meId = '';
  loading = false;
  busy = false;
  claimed = false;
  message = '';
  error = '';
  history: any[] = [];
  historyOpen = false;
  historyLoading = false;
  historyError = false;
  page = 1;
  total = 0;
  private requests = new Subscription();
  constructor(private moments: MomentService, private users: UserService, private router: Router) {}
  /** Đóng modal (route moment-reward) và quay lại feed. */
  close(): void {
    this.router.navigate(['/social/moment']);
  }
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
  ngOnInit(): void {
    this.requests.add(this.users.getCurrentUser().subscribe(me => { this.meId = UserService.profileId(me); }));
    this.refresh();
  }
  ngOnDestroy(): void { this.requests.unsubscribe(); }
  alreadyClaimed(): boolean { return this.claimed || (this.fund?.monetaryGrabbedUsers || []).some((id: any) => String(id) === this.meId); }
  eligible(): boolean { return !!this.meId && !!this.fund?.eligibleUsers && Object.prototype.hasOwnProperty.call(this.fund.eligibleUsers, this.meId); }
  refresh(): void {
    this.loading = true; this.error = '';
    this.requests.add(this.moments.getActiveMomentReward().subscribe({
      next: res => { this.fund = res?.data; this.loading = false; },
      error: e => { this.error = e?.error?.message || 'social.loadFailed'; this.loading = false; },
    }));
  }
  claim(credit = false): void {
    if (this.busy || !this.meId || (!credit && (!this.eligible() || this.alreadyClaimed()))) return;
    this.busy = true; this.error = ''; this.message = '';
    this.requests.add((credit ? this.moments.claimCreditReward() : this.moments.claimMomentReward()).subscribe({
      next: res => {
        this.busy = false;
        if (res?.data == null) { this.error = res?.message || 'social.rewardFailed'; return; }
        this.message = `${res.data}`;
        if (!credit) this.claimed = true;
        this.refresh();
        if (this.historyOpen) this.loadHistory(1);
      }, error: e => { this.busy = false; this.error = e?.error?.message || 'social.rewardFailed'; },
    }));
  }
  toggleHistory(): void { this.historyOpen = !this.historyOpen; if (this.historyOpen) this.loadHistory(1); }
  loadHistory(page: number): void {
    if (this.historyLoading || page < 1) return;
    this.historyLoading = true; this.historyError = false;
    this.requests.add(this.moments.getClaimedMomentRewards(page).subscribe({
      next: res => { this.history = res?.data?.list || []; this.total = res?.data?.paging?.totalRows || 0; this.page = page; this.historyLoading = false; },
      error: () => { this.historyLoading = false; this.historyError = true; },
    }));
  }
}
