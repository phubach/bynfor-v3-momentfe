import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Rail hành động bên phải (ảnh 1): sound, endorse (credit), like + count,
 * report, comment + count, more. Logic click do container xử lý, giữ nguyên BE gốc.
 */
@Component({
  selector: 'app-action-rail',
  standalone: false,
  templateUrl: './action-rail.component.html',
  styleUrls: ['./action-rail.component.scss'],
})
export class ActionRailComponent {
  @Input() muted = true;
  @Input() liked = false;
  @Input() likeCount = 0;
  @Input() commentCount = 0;
  @Input() endorsed = false;
  @Input() endorseCount = 0;
  @Input() canReport = true;

  @Output() toggleMute = new EventEmitter<void>();
  @Output() endorse = new EventEmitter<void>();
  @Output() like = new EventEmitter<void>();
  @Output() openLikes = new EventEmitter<void>();
  @Output() report = new EventEmitter<void>();
  @Output() openComments = new EventEmitter<void>();
  @Output() feedback = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
}
