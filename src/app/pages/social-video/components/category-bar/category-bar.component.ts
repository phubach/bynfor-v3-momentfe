import { Component, EventEmitter, Input, Output } from '@angular/core';
import { VideoCategory } from '../../social-video.model';

/** Thanh category ngang (Back / All / Society / ... / Other) — layout Facebook pill. */
@Component({
  selector: 'app-category-bar',
  standalone: false,
  templateUrl: './category-bar.component.html',
  styleUrls: ['./category-bar.component.scss'],
})
export class CategoryBarComponent {
  @Input() categories: VideoCategory[] = [];
  @Input() selectedId: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() select = new EventEmitter<string | null>();
  /** Mở lưới lịch sử đã xem (gốc: video-history page). */
  @Output() history = new EventEmitter<void>();
}
