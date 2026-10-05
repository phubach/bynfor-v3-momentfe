import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Modal xác nhận dùng chung, thay cho hộp thoại xác nhận của trình duyệt. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: false,
  template: `
    <div class="confirm-overlay" *ngIf="open" role="dialog" aria-modal="true" [attr.aria-label]="titleKey | i18next" (click)="cancel()">
      <section class="confirm-panel" (click)="$event.stopPropagation()">
        <header>
          <h3><i class="fa" [ngClass]="icon" aria-hidden="true"></i> {{ titleKey | i18next }}</h3>
          <button type="button" (click)="cancel()" [disabled]="busy" aria-label="Close">×</button>
        </header>
        <p>{{ messageKey | i18next: messageParams }}</p>
        <footer>
          <button type="button" class="cancel" (click)="cancel()" [disabled]="busy">{{ 'social.cancel' | i18next }}</button>
          <button type="button" class="confirm" (click)="confirmed.emit()" [disabled]="busy">
            <i class="fa" [ngClass]="busy ? 'fa-spinner fa-spin' : icon" aria-hidden="true"></i> {{ confirmKey | i18next }}
          </button>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    .confirm-overlay{position:fixed;inset:0;z-index:220;display:flex;align-items:center;justify-content:center;padding:56px 24px 32px;background:rgba(7,22,48,.93)}
    .confirm-panel{width:min(520px,calc(100vw - 48px));overflow:hidden;border:1px solid rgba(255,255,255,.74);border-radius:18px;background:#fff;box-shadow:0 24px 68px rgba(0,0,0,.38)}
    header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid #e7eef8}h3{margin:0;color:#14213d;font-size:18px}h3 i{margin-right:9px;color:#1769ff}header button{width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:#5e6f93;font-size:23px;line-height:1;cursor:pointer}header button:hover{background:#f1f5fb;color:#14213d}p{margin:0;padding:22px;color:#14213d;font-size:15px;line-height:1.55}footer{display:flex;justify-content:flex-end;gap:10px;padding:15px 22px;border-top:1px solid #e7eef8;background:#f8fbff}footer button{border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer}.cancel{background:#eaf0f8;color:#334462}.confirm{background:#1769ff;color:#fff}.confirm:hover{background:#0d55d8}.confirm i{margin-right:6px}@media(max-width:640px){.confirm-overlay{padding:24px 12px}.confirm-panel{width:calc(100vw - 24px)}}
  `],
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() busy = false;
  @Input() titleKey = 'social.confirm';
  @Input() messageKey = '';
  @Input() messageParams: Record<string, unknown> = {};
  @Input() confirmKey = 'social.confirm';
  @Input() icon = 'fa-check-circle';
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();

  cancel(): void { if (!this.busy) this.closed.emit(); }
}
