import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReelComment } from '../../social-video.model';

export interface TextSeg {
  kind: 'text' | 'link' | 'tag';
  value: string;
}

/**
 * Bottom-sheet bình luận (gốc: comments-content + #idModalVideoComment):
 * comment + reply, sửa/xoá, like comment bằng emoji preset (gốc: social-moment-emoji popover),
 * render link + hashtag bấm được (gốc: linkify/innerHashTag),
 * gợi ý hashtag khi gõ (gốc: onSearchHashTag), chèn emoji khi gõ (gốc: app-emoji),
 * bấm avatar xem profile (gốc: showModalProfile).
 */
@Component({
  selector: 'app-comment-sheet',
  standalone: false,
  templateUrl: './comment-sheet.component.html',
  styleUrls: ['./comment-sheet.component.scss'],
})
export class CommentSheetComponent {
  @Input() comments: ReelComment[] = [];
  @Input() draft = '';
  @Input() sending = false;
  @Input() replyTo: ReelComment | null = null;
  @Input() editingId: string | null = null;
  @Input() myUserId: number | string | null = null;
  /** Gợi ý hashtag từ BE searchHashTag [{name, count}]. */
  @Input() hashTags: Array<{ name: string; count?: number }> = [];

  @Output() draftChange = new EventEmitter<string>();
  /** Gõ text (kèm vị trí caret) để container dò hashtag. */
  @Output() draftInput = new EventEmitter<{ text: string; caret: number }>();
  @Output() hashTagPick = new EventEmitter<string>();
  @Output() send = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Output() reply = new EventEmitter<ReelComment>();
  @Output() cancelReply = new EventEmitter<void>();
  @Output() edit = new EventEmitter<ReelComment>();
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() saveEdit = new EventEmitter<{ c: ReelComment; text: string }>();
  @Output() remove = new EventEmitter<ReelComment>();
  @Output() like = new EventEmitter<{ c: ReelComment; emoji: string }>();
  @Output() hashtag = new EventEmitter<string>();
  @Output() openProfile = new EventEmitter<any>();

  editText = '';
  showMainEmoji = false;
  editEmojiFor: string | null = null;
  chooserFor: string | null = null;
  lastCaret = 0;

  readonly expressionPresets = ['👍', '💖', '😍', '😀', '😱', '😭', '😡'];
  readonly typingEmojis = ['😀', '😍', '💖', '👍', '😭', '😱', '😡', '🎉', '🙏', '❤️'];

  roots(): ReelComment[] {
    return (this.comments || []).filter((c) => !c.parent_id && !c.parentId);
  }

  repliesOf(id?: string): ReelComment[] {
    if (!id) return [];
    return (this.comments || []).filter((c) => c.parent_id === id || c.parentId === id);
  }

  key(c: ReelComment): string {
    return c.comment_id || (c.commentedAt || '') + (c.comment || c.message || '');
  }

  rawText(c: ReelComment): string {
    const s = c.comment || c.message || '';
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }

  /** Tách text thành đoạn thường / link / hashtag (gốc: linkify + innerHashTag). */
  segments(c: ReelComment): TextSeg[] {
    const raw = this.rawText(c);
    const out: TextSeg[] = [];
    const re = /(\bhttps?:\/\/[^\s<]+)|(#[^\s#]+)/gi;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      if (m.index > last) out.push({ kind: 'text', value: raw.slice(last, m.index) });
      if (m[1]) out.push({ kind: 'link', value: m[1] });
      else out.push({ kind: 'tag', value: (m[2] || '').replace(/^#/, '') });
      last = m.index + m[0].length;
    }
    if (last < raw.length) out.push({ kind: 'text', value: raw.slice(last) });
    return out.length ? out : [{ kind: 'text', value: raw }];
  }

  openLink(url: string): void {
    window.open(url, '_blank');
  }

  name(c: ReelComment): string {
    const u: any = c.createdByFull || {};
    return u.userName || [u.firstName, u.lastName].filter(Boolean).join(' ') || c.userName || c.firstName || '';
  }

  mine(c: ReelComment): boolean {
    return this.myUserId != null && (c.from === this.myUserId || c.createdBy === this.myUserId);
  }

  likeCount(c: ReelComment): number {
    return (c.expressions || []).length;
  }

  iLiked(c: ReelComment): boolean {
    return (c.expressions || []).some((e) => String(e.expressedBy) === String(this.myUserId));
  }

  myEmoji(c: ReelComment): string {
    const mine = (c.expressions || []).find((e) => String(e.expressedBy) === String(this.myUserId));
    return mine?.expressedContent || '👍';
  }

  lastEmoji(c: ReelComment): string {
    const list = (c.expressions || []).map((e) => e.expressedContent).filter(Boolean);
    return list.length ? list[list.length - 1] : '';
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${mon} ${pad(d.getDate())}, ${d.getFullYear()}, ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
  }

  startEdit(c: ReelComment): void {
    this.editText = this.rawText(c);
    this.editEmojiFor = null;
    this.edit.emit(c);
  }

  appendEmoji(native: string): void {
    this.draftChange.emit((this.draft || '') + native);
    this.showMainEmoji = false;
  }

  appendEditEmoji(native: string): void {
    this.editText = (this.editText || '') + native;
  }

  onDraftInput(el: HTMLInputElement): void {
    this.lastCaret = el.selectionStart || 0;
    this.draftChange.emit(el.value);
    this.draftInput.emit({ text: el.value, caret: this.lastCaret });
  }

  trackCaret(el: HTMLInputElement): void {
    this.lastCaret = el.selectionStart || 0;
  }
}
