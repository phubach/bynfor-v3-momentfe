import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReelVideo } from '../../social-video.model';

/** Khối info dưới-trái: avatar + tên + nút follow + mô tả/hashtag (highLightContent gốc). */
@Component({
  selector: 'app-reel-info',
  standalone: false,
  templateUrl: './reel-info.component.html',
  styleUrls: ['./reel-info.component.scss'],
})
export class ReelInfoComponent {
  @Input() video: ReelVideo | null = null;
  @Input() followed = false;
  @Input() followLoading = false;
  @Input() isOwn = false;

  @Output() follow = new EventEmitter<void>();
  @Output() unfollow = new EventEmitter<void>();
  @Output() openProfile = new EventEmitter<void>();
  @Output() hashtag = new EventEmitter<string>();

  displayName(): string {
    const u = this.video?.userResponseMoment || {};
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || '';
  }

  avatarText(): string {
    const u = this.video?.userResponseMoment || {};
    const s = ((u.firstName || u.userName || '?') + '').trim();
    return (s.charAt(0) || '?').toUpperCase();
  }

  /** Render mô tả + bôi hashtag dạng link (thay cho innerHTML + document.click gốc). */
  parts(): Array<{ text: string; tag?: string }> {
    const raw: string = this.video?.content || this.video?.description || '';
    if (!raw) return [];
    const out: Array<{ text: string; tag?: string }> = [];
    const re = /#[^\s#]+/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      if (m.index > last) out.push({ text: raw.slice(last, m.index) });
      out.push({ text: m[0], tag: m[0].replace(/^#/, '') });
      last = m.index + m[0].length;
    }
    if (last < raw.length) out.push({ text: raw.slice(last) });
    return out;
  }
}
