import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { VideoCategory } from '../../social-video.model';

/**
 * Thanh category ngang (Back / All / Society / ... / Other + History).
 * UI + scroll đồng bộ với thanh category của trang Categories (.cat-row):
 * pills phẳng, scrollbar native hiện luôn.
 */
@Component({
  selector: 'app-category-bar',
  standalone: false,
  templateUrl: './category-bar.component.html',
  styleUrls: ['./category-bar.component.scss'],
})
export class CategoryBarComponent implements OnChanges {
  @Input() categories: VideoCategory[] = [];
  @Input() selectedId: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() select = new EventEmitter<string | null>();
  /** Mở lưới lịch sử đã xem (gốc: video-history page). */
  @Output() history = new EventEmitter<void>();

  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedId'] && !changes['selectedId'].firstChange) this.scrollActiveIntoView(false);
  }

  pick(id: string | null, e: Event): void {
    this.select.emit(id);
    const btn = e.currentTarget as HTMLElement | null;
    btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  private scrollActiveIntoView(smooth: boolean): void {
    const root = this.scroller?.nativeElement;
    const active = root?.querySelector('.cat-pill.active') as HTMLElement | null;
    active?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', inline: 'center', block: 'nearest' });
  }
}
