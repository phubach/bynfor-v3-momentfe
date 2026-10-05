import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { MomentService } from '../../../services/moment.service';
import { UserService } from '../../../services/user.service';
import { ToastService } from '../../../shared/toast/toast.service';

/**
 * 2 modal quà giống project gốc (sum-act-wall):
 * - view 'grab' = #redPackageModelMomentShare (mở bao, Better luck, View all)
 * - view 'details' = #redPackageModelMoment (danh sách người nhận + tổng kết)
 */
@Component({
  selector: 'app-red-packet',
  standalone: false,
  templateUrl: './red-packet.component.html',
  styleUrls: ['./red-packet.component.scss'],
})
export class RedPacketComponent implements OnInit {
  @Input() moment: any = null;
  @Input() meId = '';
  @Input() view: 'grab' | 'details' = 'grab';
  @Input() luckyNext = false;
  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<any>();

  grabbers: any[] = [];
  totalCollected = '0.00';
  totalRows = 0;
  myRank: any = '';
  myRankIndex = 0;
  page = 1;
  readonly size = 5;
  loadingGrabbers = false;
  grabbing = false;
  imageShare = false;
  avatarBroken = false;
  brokenUrls = new Set<string>();
  moneyGrabbed: number | null = null;
  grabError = '';

  constructor(private moments: MomentService, private router: Router, private toast: ToastService) {}

  ngOnInit(): void {
    if (this.view === 'details') this.loadGrabbers(1);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  available(): number {
    return Number(this.moment?.availableMoney) || 0;
  }

  creator(): any {
    return this.moment?.createdByFull || this.moment?.userResponseMoment || {};
  }

  creatorName(): string {
    const u = this.creator();
    const full = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
    return full || u?.fullName || u?.name || u?.userName || '';
  }

  creatorAvatar(): string {
    if (this.avatarBroken) return '';
    return UserService.avatarUrl(this.creator());
  }

  onAvatarError(): void {
    this.avatarBroken = true;
  }

  itemAvatar(item: any): string {
    const url = UserService.avatarUrl(item);
    return url && !this.brokenUrls.has(url) ? url : '';
  }

  onItemAvatarError(item: any): void {
    const url = UserService.avatarUrl(item);
    if (url) this.brokenUrls.add(url);
  }

  creatorInitials(): string {
    const u = this.creator();
    if (u?.firstName) return ((u.firstName.charAt(0) + (u.lastName ? u.lastName.charAt(0) : '')) || '?').toUpperCase();
    return ((u?.userName || '?').replace(/\s+/g, '').slice(0, 2) || '?').toUpperCase();
  }

  intPart(v: any): string {
    return Math.trunc(Number(v) || 0).toString();
  }

  decPart(v: any): string {
    return (Math.abs(Number(v) || 0) % 1).toFixed(2).slice(2);
  }

  /** Mở bao (giống grabRedPacketMoneyShare gốc). */
  doGrab(): void {
    if (this.grabbing || !this.meId || !this.moment?._id) return;
    this.grabbing = true;
    this.imageShare = true;
    this.grabError = '';
    this.moments.grabMonetaryGift(this.moment._id, this.meId).subscribe({
      next: (res: any) => {
        this.grabbing = false;
        if (res?.data) {
          Object.assign(this.moment, res.data);
          this.moneyGrabbed = res.data.moneyGrabbed != null ? Number(res.data.moneyGrabbed) : null;
          this.updated.emit(this.moment);
          if (this.moneyGrabbed == null) this.luckyNext = true;
        } else {
          this.grabError = res?.message || 'social.actionFailed';
          this.luckyNext = true;
        }
      },
      error: (e: any) => {
        this.grabbing = false;
        this.grabError = e?.error?.message || 'social.actionFailed';
        this.toast.error(e);
        this.luckyNext = true;
      },
    });
  }

  switchToDetails(): void {
    this.view = 'details';
    this.loadGrabbers(1);
  }

  loadGrabbers(page: number): void {
    if (!this.moment?._id || this.loadingGrabbers || page < 1) return;
    this.loadingGrabbers = true;
    this.moments.getWalletActionByMomentPage(this.moment._id, page, this.size).subscribe({
      next: (res: any) => {
        this.loadingGrabbers = false;
        if (res?.data) {
          this.grabbers = res.data.list || [];
          this.totalCollected = res.data.totalCollected != null ? Number(res.data.totalCollected).toFixed(2) : '0.00';
          this.totalRows = res.data.paging?.totalRows || 0;
          this.myRank = res.data.myRank || '';
          this.myRankIndex = res.data.myRankIndex || 0;
          this.page = page;
        }
      },
      error: (e: any) => {
        this.loadingGrabbers = false;
        this.toast.error(e);
      },
    });
  }

  changePage(delta: number): void {
    this.loadGrabbers(this.page + delta);
  }

  myRankPage(): void {
    if (!this.myRankIndex) return;
    this.loadGrabbers(Math.ceil(this.myRankIndex / this.size));
  }

  goToProfile(userId: any): void {
    if (!userId) return;
    this.close();
    this.router.navigate(['/social/social-media-profile', userId]);
  }

  isMeGrabber(item: any): boolean {
    return String(item?.customerId) === String(this.meId);
  }

  itemInitials(item: any): string {
    if (item?.firstName) return ((item.firstName.charAt(0) + (item.lastName ? item.lastName.charAt(0) : '')) || '?').toUpperCase();
    return ((item?.userName || '?').replace(/\s+/g, '').slice(0, 2) || '?').toUpperCase();
  }
}
