import { Component, EventEmitter, Inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { I18NEXT_SERVICE, ITranslationService } from 'angular-i18next';
import { REPORT_REASONS } from '../../social-video.model';
import { AlertService } from '../../../../services/alert.service';
import { videoFileError } from '../../../../shared/utils/file.utils';

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

  constructor(
    private alertService: AlertService,
    @Inject(I18NEXT_SERVICE) private i18n: ITranslationService,
  ) {}
  other = '';
  isOther = false;
  note = '';
  images: File[] = [];
  imagePreviews: string[] = [];
  videoFile: File | null = null;
  videoUrl = '';
  documents: File[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['savedReport'] || (changes['open'] && this.open)) {
      this.isOther = !!this.savedReport?.isOthers;
      this.other = this.isOther ? this.savedReport?.message || '' : '';
      this.selected = this.isOther ? '__other' : this.savedReport?.message || '';
      this.note = '';
      this.clearFiles();
    }
  }

  private clearFiles(): void {
    this.imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    this.imagePreviews = [];
    this.images = [];
    this.videoFile = null;
    this.videoUrl = '';
    this.documents = [];
  }

  send(): void {
    const reason = (this.detailed ? this.selected : (this.isOther ? this.other : this.selected)).trim();
    if (!reason || this.busy) return;
    this.submit.emit({ reason, other: this.other, isOther: this.isOther, note: this.note, images: this.images, videoFile: this.videoFile, videoUrl: this.videoUrl.trim(), documents: this.documents });
  }

  selectImages(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files || []).filter((f) => f.type.startsWith('image/'));
    this.images = files;
    this.imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    this.imagePreviews = files.map((f) => URL.createObjectURL(f));
    (event.target as HTMLInputElement).value = '';
  }
  selectVideo(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    const errKey = videoFileError(file);
    if (errKey) {
      this.alertService.errorTop(this.i18n.t(errKey));
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.videoFile = file;
  }
  selectDocuments(event: Event): void {
    this.documents = Array.from((event.target as HTMLInputElement).files || []);
    (event.target as HTMLInputElement).value = '';
  }
  removeImage(index: number): void {
    this.images = this.images.filter((_, i) => i !== index);
    const [revoked] = this.imagePreviews.splice(index, 1);
    if (revoked) URL.revokeObjectURL(revoked);
  }
  removeDocument(index: number): void { this.documents = this.documents.filter((_, i) => i !== index); }
  wordsLeft(): number { const text = this.note.trim(); return 120 - (text ? text.split(/\s+/).length : 0); }
}
