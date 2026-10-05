import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { TagUser, UserService } from '../../services/user.service';

@Component({
  selector: 'app-tag-people', standalone: false,
  template: `
    <div class="tagged" *ngIf="selected.length">
      <button type="button" *ngFor="let user of selected" (click)="remove(user)">{{ user.fullName || user.userName }} <span aria-hidden="true">×</span></button>
    </div>
    <label>{{ 'social.tagSomeone' | i18next }}
      <input [ngModel]="keyword" (ngModelChange)="search($event)" [placeholder]="'social.searchPeople' | i18next" />
    </label>
    <small role="status" *ngIf="error">{{ 'social.loadFailed' | i18next }}</small>
    <div class="people" *ngIf="keyword || expanded">
      <button type="button" *ngFor="let user of available()" (click)="add(user)" [disabled]="selected.length >= 10">
        <span class="initial">{{ (user.fullName || user.userName).slice(0, 1) }}</span>{{ user.fullName || user.userName }} <span>+</span>
      </button>
      <small *ngIf="!available().length">{{ 'social.noPeople' | i18next }}</small>
    </div>
    <button type="button" class="toggle" (click)="expanded = !expanded">{{ (expanded ? 'social.cancel' : 'social.tagSomeone') | i18next }} · {{ selected.length }}/10</button>
  `,
  styles: [`:host{display:block}label{display:grid;gap:6px;font-size:13px;color:#5e6f93}input{width:100%;padding:10px 12px;border:1px solid #d9e5f5;border-radius:12px;background:#fff;font:inherit}.people{display:grid;gap:4px;max-height:210px;overflow:auto;margin-top:8px}.people button{display:flex;align-items:center;gap:8px;text-align:left;padding:8px;border:0;border-radius:10px;background:#f1f6ff;color:#14213d}.people button span:last-child{margin-left:auto}.initial{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#dceaff;color:#1769ff}.tagged{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.tagged button,.toggle{border:1px solid #d9e5f5;background:#fff;color:#1769ff;border-radius:20px;padding:6px 10px;cursor:pointer}.toggle{margin-top:8px}small{color:#5e6f93}`],
})
export class TagPeopleComponent implements OnInit, OnDestroy {
  @Input() selected: TagUser[] = [];
  @Output() selectedChange = new EventEmitter<TagUser[]>();
  users: TagUser[] = [];
  keyword = '';
  expanded = false;
  error = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request?: Subscription;
  private relatives?: Subscription;
  private sequence = 0;
  constructor(private userService: UserService) {}
  ngOnInit(): void { this.relatives = this.userService.getTagRelatives().subscribe(users => { this.users = [...new Map([...(users || []), ...this.users].map(u => [u.id, u])).values()]; }); }
  ngOnDestroy(): void { clearTimeout(this.timer); this.sequence++; this.request?.unsubscribe(); this.relatives?.unsubscribe(); }
  available(): TagUser[] {
    const q = this.keyword.trim().toLocaleLowerCase();
    return this.users.filter(u => !this.selected.some(s => String(s.id) === String(u.id)) && `${u.fullName} ${u.userName}`.toLocaleLowerCase().includes(q)).slice(0, 20);
  }
  search(value: string): void {
    this.keyword = value; this.error = false; clearTimeout(this.timer); this.request?.unsubscribe();
    const sequence = ++this.sequence;
    if (value.trim().length < 2) return;
    this.timer = setTimeout(() => {
      this.request = this.userService.findUserSuggestion(value.trim(), 1).subscribe({
        next: res => {
          if (sequence !== this.sequence) return;
          const users = UserService.normalizeTagUsers(res?.data);
          this.users = [...new Map([...this.users, ...users].map(u => [u.id, u])).values()];
        }, error: () => { if (sequence === this.sequence) this.error = true; },
      });
    }, 300);
  }
  add(user: TagUser): void {
    if (this.selected.length >= 10 || this.selected.some(u => String(u.id) === String(user.id))) return;
    this.selected = [...this.selected, user]; this.selectedChange.emit(this.selected);
  }
  remove(user: TagUser): void { this.selected = this.selected.filter(u => String(u.id) !== String(user.id)); this.selectedChange.emit(this.selected); }
}
