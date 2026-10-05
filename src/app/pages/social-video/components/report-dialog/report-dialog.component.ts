import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { REPORT_REASONS } from '../../social-video.model';

/** Dialog report video (gốc: reportReasons + report()). */
@Component({
  selector: 'app-report-dialog',
  standalone: false,
  templateUrl: './report-dialog.component.html',
  styleUrls: ['./report-dialog.component.scss'],
})
export class ReportDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() busy = false;
  @Input() detailed = false;
  @Input() savedReport: any = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() submit = new EventEmitter<any>();

  reasons = REPORT_REASONS;
  selected = '';
  other = '';
  isOther = false;
  note = '';
  images: File[] = [];
  videoFile: File | null = null;
  videoUrl = '';
  documents: File[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['savedReport'] || (changes['open'] && this.open)) {
      this.isOther = !!this.savedReport?.isOthers;
      this.other = this.isOther ? this.savedReport?.message || '' : '';
      this.selected = this.isOther ? '__other' : this.savedReport?.message || '';
      this.note = '';
      this.images = [];
      this.videoFile = null;
      this.videoUrl = '';
      this.documents = [];
    }
  }

  send(): void {
    const reason = (this.detailed ? this.selected : (this.isOther ? this.other : this.selected)).trim();
    if (!reason || this.busy) return;
    this.submit.emit({ reason, other: this.other, isOther: this.isOther, note: this.note, images: this.images, videoFile: this.videoFile, videoUrl: this.videoUrl.trim(), documents: this.documents });
  }

  selectImages(event: Event): void { this.images = Array.from((event.target as HTMLInputElement).files || []); }
  selectVideo(event: Event): void { this.videoFile = (event.target as HTMLInputElement).files?.[0] || null; }
  selectDocuments(event: Event): void { this.documents = Array.from((event.target as HTMLInputElement).files || []); }
  removeImage(index: number): void { this.images = this.images.filter((_, i) => i !== index); }
  removeDocument(index: number): void { this.documents = this.documents.filter((_, i) => i !== index); }
  wordsLeft(): number { const text = this.note.trim(); return 120 - (text ? text.split(/\s+/).length : 0); }
}
