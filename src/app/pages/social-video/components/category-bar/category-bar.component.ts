import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { VideoCategory } from '../../social-video.model';

/** Thanh category ngang full-width (Back / All / Society / ... / Other + History). */
@Component({
  selector: 'app-category-bar',
  standalone: false,
  templateUrl: './category-bar.component.html',
  styleUrls: ['./category-bar.component.scss'],
})
export class CategoryBarComponent implements OnChanges, AfterViewInit {
  @Input() categories: VideoCategory[] = [];
  @Input() selectedId: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() select = new EventEmitter<string | null>();
  /** Mở lưới lịch sử đã xem (gốc: video-history page). */
  @Output() history = new EventEmitter<void>();

  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

  /** Chỉ mờ cạnh nào còn cuộn được — không phủ trắng pill lúc không cần. */
  canLeft = false;
  canRight = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedId'] && !changes['selectedId'].firstChange) this.scrollActiveIntoView(false);
    if (changes['categories']) setTimeout(() => this.updateEdges(), 0);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateEdges(), 0);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateEdges();
  }

  onScroll(): void {
    this.updateEdges();
  }

  pick(id: string | null, e: Event): void {
    this.select.emit(id);
    const btn = e.currentTarget as HTMLElement | null;
    btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  scrollBy(dir: number): void {
    this.scroller?.nativeElement.scrollBy({ left: dir * 340, behavior: 'smooth' });
  }

  private updateEdges(): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    this.canLeft = el.scrollLeft > 4;
    this.canRight = el.scrollLeft < max - 4;
  }

  private scrollActiveIntoView(smooth: boolean): void {
    const root = this.scroller?.nativeElement;
    const active = root?.querySelector('.cat-pill.active') as HTMLElement | null;
    active?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', inline: 'center', block: 'nearest' });
  }
}
