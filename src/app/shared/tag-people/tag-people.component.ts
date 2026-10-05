import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { TagUser, UserService } from '../../services/user.service';

@Component({
  selector: 'app-tag-people', standalone: false,
  template: `
    <div class="tag-search">
      <label>{{ 'social.tagSomeone' | i18next }}
        <input [ngModel]="keyword" (ngModelChange)="search($event)" [placeholder]="'social.searchPeople' | i18next" />
      </label>
      <small role="status" *ngIf="error">{{ 'social.loadFailed' | i18next }}</small>
      <div class="people" *ngIf="keyword || expanded" (scroll)="onPeopleScroll($event)">
        <button type="button" *ngFor="let user of available()" (click)="add(user)" [disabled]="selected.length >= 10">
          <span class="initial">{{ (user.fullName || user.userName).slice(0, 1) }}</span>{{ user.fullName || user.userName }} <span>+</span>
        </button>
        <small *ngIf="!loading && !available().length">{{ 'social.noPeople' | i18next }}</small>
        <small *ngIf="loading">{{ 'social.loading' | i18next }}</small>
      </div>
    </div>
    <div class="tagged" *ngIf="selected.length">
      <button type="button" *ngFor="let user of selected" (click)="remove(user)">{{ user.fullName || user.userName }} <span aria-hidden="true">×</span></button>
    </div>
    <button type="button" class="toggle" (click)="togglePeople()">{{ (expanded ? 'social.cancel' : 'social.tagSomeone') | i18next }} · {{ selected.length }}/10</button>
  `,
  styles: [`:host{display:block;position:relative}.tag-search{position:relative}label{display:grid;gap:6px;font-size:13px;color:#5e6f93}input{width:100%;padding:10px 12px;border:1px solid #d9e5f5;border-radius:12px;background:#fff;font:inherit}.people{position:absolute;z-index:35;top:calc(100% + 8px);left:0;right:0;display:grid;gap:4px;max-height:240px;overflow:auto;padding:6px;border:1px solid #d9e5f5;border-radius:14px;background:#fff;box-shadow:0 14px 30px rgba(15,31,74,.16)}.people button{display:flex;align-items:center;gap:8px;text-align:left;padding:8px;border:0;border-radius:10px;background:#f1f6ff;color:#14213d}.people button span:last-child{margin-left:auto}.initial{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#dceaff;color:#1769ff}.tagged{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.tagged button,.toggle{border:1px solid #d9e5f5;background:#fff;color:#1769ff;border-radius:20px;padding:6px 10px;cursor:pointer}.toggle{margin-top:8px}small{color:#5e6f93}`],
})
export class TagPeopleComponent implements OnInit, OnDestroy {
  @Input() selected: TagUser[] = [];
  @Output() selectedChange = new EventEmitter<TagUser[]>();
  users: TagUser[] = [];
  private relativesUsers: TagUser[] = [];
  keyword = '';
  expanded = false;
  error = false;
  loading = false;
  private page = 0;
  private hasMore = true;
  private query = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request?: Subscription;
  private relatives?: Subscription;
  private sequence = 0;
  constructor(private userService: UserService) {}
  ngOnInit(): void {
    this.relatives = this.userService.getTagRelatives().subscribe(users => { this.relativesUsers = users || []; });
  }
  ngOnDestroy(): void { clearTimeout(this.timer); this.sequence++; this.request?.unsubscribe(); this.relatives?.unsubscribe(); }
  available(): TagUser[] {
    return this.users.filter(u => !this.selected.some(s => String(s.id) === String(u.id)));
  }
  search(value: string): void {
    this.keyword = value;
    this.error = false;
    clearTimeout(this.timer);
    const query = this.searchTerm(value);
    this.timer = setTimeout(() => this.startSearch(query), 300);
  }
  togglePeople(): void {
    this.expanded = !this.expanded;
    if (this.expanded) this.startSearch(this.searchTerm(this.keyword));
  }
  onPeopleScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) this.loadNextPage();
  }
  private startSearch(query: string): void {
    this.query = query;
    this.page = 0;
    this.hasMore = true;
    this.users = [];
    this.loadNextPage();
  }
  private loadNextPage(): void {
    if (this.loading || !this.hasMore) return;
    const page = this.page + 1;
    const sequence = ++this.sequence;
    this.loading = true;
    this.request?.unsubscribe();
    this.request = this.userService.findUserSuggestion(this.query, page).subscribe({
      next: res => {
        if (sequence !== this.sequence) return;
        const found = UserService.normalizeTagUsers(res?.data);
        this.users = [...new Map([...this.users, ...found].map(u => [u.id, u])).values()];
        this.page = page;
        this.hasMore = this.responseHasMore(res, found.length, page);
        this.loading = false;
      },
      error: () => {
        if (sequence !== this.sequence) return;
        // Danh sách bạn bè/following vẫn là dự phòng khi API gợi ý tạm thời lỗi.
        if (page === 1) this.users = this.filterRelatives(this.query).slice(0, 10);
        this.hasMore = false;
        this.loading = false;
        this.error = true;
      },
    });
  }
  private responseHasMore(res: any, count: number, page: number): boolean {
    const data = res?.data || {};
    const totalPages = Number(data?.totalPages ?? res?.totalPages);
    if (Number.isFinite(totalPages) && totalPages > 0) return page < totalPages;
    const total = Number(data?.total ?? data?.totalElements ?? res?.total ?? res?.totalElements);
    if (Number.isFinite(total) && total >= 0) return page * 10 < total;
    return count >= 10;
  }
  private filterRelatives(query: string): TagUser[] {
    const q = query.toLocaleLowerCase();
    return this.relativesUsers.filter(u => `${u.fullName} ${u.userName}`.toLocaleLowerCase().includes(q));
  }
  private searchTerm(value: string): string { return (value || '').trim().replace(/^@+\s*/, ''); }
  add(user: TagUser): void {
    if (this.selected.length >= 10 || this.selected.some(u => String(u.id) === String(user.id))) return;
    this.selected = [...this.selected, user];
    this.selectedChange.emit(this.selected);
    // Chọn xong thì dọn từ khóa @ và đóng popover để form trở lại gọn gàng.
    this.keyword = '';
    this.expanded = false;
    this.error = false;
    clearTimeout(this.timer);
    this.sequence++;
    this.request?.unsubscribe();
  }
  remove(user: TagUser): void { this.selected = this.selected.filter(u => String(u.id) !== String(user.id)); this.selectedChange.emit(this.selected); }
}
