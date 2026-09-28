import { Component, EventEmitter, Input, Output } from '@angular/core';
import { REPORT_REASONS } from '../../social-video.model';

/** Dialog report video (gốc: reportReasons + report()). */
@Component({
  selector: 'app-report-dialog',
  standalone: false,
  templateUrl: './report-dialog.component.html',
  styleUrls: ['./report-dialog.component.scss'],
})
export class ReportDialogComponent {
  @Input() open = false;
  @Input() busy = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() submit = new EventEmitter<{ reason: string; other: string }>();

  reasons = REPORT_REASONS;
  selected = '';
  other = '';
  isOther = false;

  send(): void {
    this.submit.emit({ reason: this.isOther ? this.other : this.selected, other: this.other });
  }
}
