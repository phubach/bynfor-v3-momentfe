import { Injectable } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ToastService } from '../shared/toast/toast.service';

export class IAlert {
  type!: IAlertType;
  message!: string;
  alertId!: string;
  keepAfterRouteChange!: boolean;
  labelAction?: string;
  clickAction?: any;
  userId?: number;
  title?: number;
  onClick?: any;
  url?: string;
  notClose!: boolean;

  constructor(init?: Partial<IAlert>) {
    Object.assign(this, init);
  }
}

export enum IAlertType {
  Success,
  Error,
  Info,
  Warning,
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private subject = new Subject<IAlert>();
  private keepAfterRouteChange = false;
  public offerId = null;
  public isStyleModal = false;
  public noRoute = false;

  constructor(private router: Router, private toast: ToastService) {
    // clear alert messages on route change unless 'keepAfterRouteChange' flag is true
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        if (this.keepAfterRouteChange) {
          // only keep for a single route change
          this.keepAfterRouteChange = false;
        } else {
          // clear alert messages
          this.clear();
        }
      }
    });
  }

  // enable subscribing to alerts observable
  onAlert(alertId?: string): Observable<IAlert> {
    return this.subject.asObservable().pipe(filter((x) => x && x.alertId === alertId));
  }

  onAlertCleanAll(): Observable<IAlert> {
    return this.subject.asObservable();
  }

  // convenience methods
  success(message: string, alertId?: string): void {
    this.alert(new IAlert({ message, type: IAlertType.Success, alertId }));
  }

  error(message: string, alertId?: string): void {
    this.alert(new IAlert({ message, type: IAlertType.Error, alertId }));
  }

  info(message: string, alertId?: string): void {
    this.alert(new IAlert({ message, type: IAlertType.Info, alertId }));
  }

  warn(message: string, alertId?: string): void {
    this.alert(new IAlert({ message, type: IAlertType.Warning, alertId }));
  }

  // main alert method
  alert(alert: IAlert): void {
    this.keepAfterRouteChange = alert.keepAfterRouteChange;
    this.subject.next(alert);
    const msg = alert.message || '';
    if (!msg) return;
    switch (alert.type) {
      case IAlertType.Success:
        this.toast.show(msg, 'success');
        break;
      case IAlertType.Error:
        this.toast.show(msg, 'error');
        break;
      default:
        this.toast.show(msg, 'info');
        break;
    }
  }

  // clear alerts
  clear(alertId?: string): void {
    this.subject.next(new IAlert({ alertId }));
  }

  successTop(message: string, title?: string, onClick?: any, isAlertModal?: boolean): void {
    void title;
    void onClick;
    void isAlertModal;
    this.alert(new IAlert({ message, type: IAlertType.Success, alertId: 'topAlertId' } as any));
  }

  infoTop(message: string, title?: string, onClick?: any): void {
    void onClick;
    const alertId = 'topAlertId';
    this.alert(new IAlert({ message, type: IAlertType.Info, alertId, title } as any));
  }

  errorTop(message: string, isAlertModal?: boolean): void {
    void isAlertModal;
    this.alert(new IAlert({ message, type: IAlertType.Error, alertId: 'topAlertId' }));
  }

  errorTopWithAction(
    message: string,
    labelAction: string,
    action: string,
    userId: number,
    url?: string,
    notClose?: boolean,
  ): void {
    this.alert(
      new IAlert({ message, type: IAlertType.Error, alertId: 'topAlertId', labelAction, clickAction: action, userId, url, notClose }),
    );
  }

  successTopWithAction(message: string, labelAction: string, action: string, userId: number): void {
    const alertId = 'topAlertId';
    this.alert(new IAlert({ message, type: IAlertType.Success, alertId, labelAction, clickAction: action, userId } as any));
  }
}
