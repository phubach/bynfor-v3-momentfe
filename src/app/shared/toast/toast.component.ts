import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastItem, ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: false,
  template: `<div class="toast-stack" aria-live="polite"><div class="toast" [ngClass]="'is-' + t.kind" *ngFor="let t of toasts" role="alert"><span class="toast-icon">{{ t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : 'i' }}</span><span class="toast-msg">{{ t.msg }}</span><button type="button" class="toast-close" (click)="close(t.id)" aria-label="Close">×</button></div></div>`,
  styles: [`.toast-stack{position:fixed;right:20px;bottom:24px;z-index:300;display:grid;gap:10px;width:min(360px,calc(100vw - 40px))}.toast{display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:14px;font-size:14px;box-shadow:0 12px 32px rgba(15,31,74,.22);background:#d9edf7;color:#31708f;border:1px solid #bce8f1;animation:toast-in .28s ease}.toast.is-success{background:#e6f6ec;color:#1c7a45;border-color:#bfe6cd}.toast.is-error{background:#fdecec;color:#b3261e;border-color:#f5c6c2}.toast-icon{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:800;background:rgba(255,255,255,.7)}.toast-msg{flex:1;line-height:1.45}.toast-close{flex:none;border:0;background:transparent;color:inherit;font-size:14px;cursor:pointer;opacity:.6}.toast-close:hover{opacity:1}@keyframes toast-in{from{opacity:0;transform:translateY(8px)}}`],
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastItem[] = [];
  private sub?: Subscription;

  constructor(private toast: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toast.toasts$.subscribe((list) => (this.toasts = list));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(id: number): void {
    this.toast.dismiss(id);
  }
}
