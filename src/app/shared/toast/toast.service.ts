import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { I18NEXT_SERVICE, ITranslationService } from 'angular-i18next';

export interface ToastItem {
  id: number;
  msg: string;
  kind: 'success' | 'error' | 'info';
}

/** Toast góc phải trên, kiểu hiển thị giống page video (sv-toast). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly items$ = new BehaviorSubject<ToastItem[]>([]);
  readonly toasts$ = this.items$.asObservable();

  constructor(@Inject(I18NEXT_SERVICE) private i18n: ITranslationService) {}

  private push(msg: string, kind: ToastItem['kind']): void {
    const id = ++this.seq;
    const list = [...this.items$.value, { id, msg, kind }].slice(-3);
    this.items$.next(list);
    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: number): void {
    this.items$.next(this.items$.value.filter((t) => t.id !== id));
  }

  show(msg: string, kind: ToastItem['kind'] = 'info'): void {
    if (msg) this.push(msg, kind);
  }

  /** Dịch key i18n, rớt về text EN khi thiếu key (giống page video). */
  tr(key: string, fallback: string): string {
    try {
      const v = this.i18n.t(key);
      return typeof v === 'string' && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  }

  success(key: string, fallback: string): void {
    this.push(this.tr(key, fallback), 'success');
  }

  /** Message lỗi BE (giống errMsg page video + gốc). */
  error(err: any, fallbackKey = 'toastr.error.request_failed', fallbackText = 'Request failed.'): void {
    const server = err?.error?.message;
    if (typeof server === 'string' && server.trim()) {
      if (server.includes('You have collect monetary gift as the follower')) {
        this.push(this.tr('you_have_collect_monetary_gift_as_the_follower_or_friend', 'You have collected a monetary gift as a follower/friend and cannot unfollow.'), 'error');
        return;
      }
      this.push(server, 'error');
      return;
    }
    this.push(this.tr(fallbackKey, fallbackText), 'error');
  }
}
