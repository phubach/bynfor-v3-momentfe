import { Component, EventEmitter, Input, Output } from '@angular/core';
import { VideoTab } from '../../social-video.model';

/** Tabs Friend / For you / Following trên đầu reels (gốc: tiktok getVideoFollowing). */
@Component({
  selector: 'app-video-tabs',
  standalone: false,
  templateUrl: './video-tabs.component.html',
  styleUrls: ['./video-tabs.component.scss'],
})
export class VideoTabsComponent {
  @Input() light = false;
  @Input() active: VideoTab = 'FOR_YOU';
  @Output() change = new EventEmitter<VideoTab>();
}
