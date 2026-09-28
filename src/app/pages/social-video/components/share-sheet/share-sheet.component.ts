import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Sheet ⋮ : copy link, share Facebook/X, xem mô tả (gốc: showMoreActions/copyLinkUrlVideo/share). */
@Component({
  selector: 'app-share-sheet',
  standalone: false,
  templateUrl: './share-sheet.component.html',
  styleUrls: ['./share-sheet.component.scss'],
})
export class ShareSheetComponent {
  @Input() open = false;
  @Input() canFeedback = true;
  @Output() close = new EventEmitter<void>();
  @Output() copy = new EventEmitter<void>();
  @Output() facebook = new EventEmitter<void>();
  @Output() twitter = new EventEmitter<void>();
  @Output() wechat = new EventEmitter<void>();
  @Output() instagram = new EventEmitter<void>();
  @Output() description = new EventEmitter<void>();
}
