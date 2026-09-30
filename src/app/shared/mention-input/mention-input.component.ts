import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { TagUser, UserService } from '../../services/user.service';

/**
 * Ô nhập bình luận có gợi ý tag @ (gọn theo social-moment-item của customerfe):
 * gõ @ -> dropdown bạn bè/followers -> chọn chèn @Tên + gửi kèm tags (ids).
 */
@Component({
  selector: 'app-mention-input',
  standalone: false,
  templateUrl: './mention-input.component.html',
  styleUrls: ['./mention-input.component.scss'],
})
export class MentionInputComponent implements OnInit, OnDestroy {
  @Input() text = '';
  @Output() textChange = new EventEmitter<string>();
  @Input() tags: string[] = [];
  @Output() tagsChange = new EventEmitter<string[]>();
  @Input() placeholder = '';
  @Input() maxlength = 255;
  @Input() multiline = false;
  @Input() showEmoji = false;
  @Input() inputClass = '';
  @Input() rows = 1;
  @Input() emojiPerLine = 8;
  @Input() emojiSize = 26;
  @Output() submitted = new EventEmitter<void>();
  @ViewChild('boxInput', { static: false }) boxInput?: ElementRef<HTMLInputElement>;
  @ViewChild('boxText', { static: false }) boxText?: ElementRef<HTMLTextAreaElement>;

  relatives: TagUser[] = [];
  suggestions: TagUser[] = [];
  showSuggest = false;
  showEmojiPanel = false;
  private searchTimer: any = null;
  private searchSeq = 0;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.getTagRelatives().subscribe((list) => {
      this.relatives = list || [];
      this.updateSuggestions();
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  displayName(u: TagUser): string {
    return u.fullName || u.userName;
  }

  avatarText(u: TagUser): string {
    if (u.firstName) return ((u.firstName.charAt(0) || '') + (u.lastName ? u.lastName.charAt(0) : '')).toUpperCase();
    const full = (u.fullName || '').trim().replace(/\s+/g, ' ');
    if (full) {
      const parts = full.split(' ');
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return full.slice(0, 2).toUpperCase();
    }
    return (u.userName || '').replace(/\s+/g, '').slice(0, 2).toUpperCase();
  }

  avatarUrl(u: TagUser): string {
    const url = (u.profilePictureUrl || '').trim();
    return url && url !== 'null' ? url : '';
  }

  onInput(value: string): void {
    this.text = value;
    this.textChange.emit(value);
    this.updateSuggestions();
    this.pruneTags();
  }

  onEnter(): void {
    if (this.showSuggest && this.suggestions.length) {
      this.select(this.suggestions[0]);
      return;
    }
    this.showSuggest = false;
    this.submitted.emit();
  }

  private updateSuggestions(): void {
    const text = this.text || '';
    const at = text.lastIndexOf('@');
    const ok =
      at >= 0 &&
      (at === 0 || text.charAt(at - 1) === ' ') &&
      text.charAt(text.length - 1) !== ' ' &&
      text.split(' ').slice(-1)[0].includes('@');
    clearTimeout(this.searchTimer);
    if (!ok) {
      this.showSuggest = false;
      this.suggestions = [];
      return;
    }
    const q = text.slice(at + 1).toLowerCase();
    this.applyLocalFilter(q);
    // Gõ từ 2 ký tự: tìm thêm trên server (giống findUserSuggestion của customerfe).
    if (q.trim().length >= 2) {
      const seq = ++this.searchSeq;
      this.searchTimer = setTimeout(() => {
        this.userService.findUserSuggestion(text.slice(at + 1).trim(), 1).subscribe({
          next: (res: any) => {
            if (seq !== this.searchSeq) return;
            const found = UserService.normalizeTagUsers(res?.data);
            if (!found.length) return;
            const seen = new Set(this.relatives.map((u) => u.id));
            found.forEach((u) => {
              if (!seen.has(u.id)) {
                seen.add(u.id);
                this.relatives.push(u);
              }
            });
            this.applyLocalFilter(q);
          },
        });
      }, 500);
    }
  }

  private applyLocalFilter(q: string): void {
    this.suggestions = this.relatives
      .filter(
        (u) =>
          (u.userName && u.userName.toLowerCase().includes(q)) ||
          (u.fullName && u.fullName.toLowerCase().includes(q)),
      )
      .slice(0, 8);
    this.showSuggest = this.suggestions.length > 0;
  }

  select(u: TagUser): void {
    const text = this.text || '';
    const at = text.lastIndexOf('@');
    const name = this.displayName(u);
    this.text = (at >= 0 ? text.slice(0, at) : text) + `@${name} `;
    this.textChange.emit(this.text);
    if (u.id && !this.tags.includes(u.id)) {
      this.tags = [...this.tags, u.id];
      this.tagsChange.emit(this.tags);
    }
    this.showSuggest = false;
    this.suggestions = [];
  }

  /** Bỏ id đã tag nếu @Tên tương ứng không còn trong text. */
  private pruneTags(): void {
    if (!this.tags.length) return;
    const byId: { [id: string]: TagUser } = {};
    this.relatives.forEach((u) => (byId[u.id] = u));
    const kept = this.tags.filter((id) => {
      const u = byId[id];
      if (!u) return true;
      return this.text.includes(`@${this.displayName(u)}`) || (u.userName && this.text.includes(`@${u.userName}`));
    });
    if (kept.length !== this.tags.length) {
      this.tags = kept;
      this.tagsChange.emit(kept);
    }
  }

  hideSuggest(): void {
    setTimeout(() => (this.showSuggest = false), 150);
  }

  /** Focus vào ô nhập (cho nút Tag Someone). */
  focus(): void {
    setTimeout(() => {
      const el = this.boxInput?.nativeElement || this.boxText?.nativeElement;
      el?.focus();
    }, 0);
  }

  toggleEmoji(): void {
    this.showEmojiPanel = !this.showEmojiPanel;
    this.showSuggest = false;
  }

  /** Chọn emoji từ ngx-emoji-mart (giống customerfe), chèn tại con trỏ. */
  onMartEmoji(e: any): void {
    const native = e?.emoji?.native || e?.native || '';
    if (native) this.insertEmoji(native);
  }

  /** Chèn emoji tại vị trí con trỏ (giữ caret như app-emoji của customerfe). */
  insertEmoji(emoji: string): void {
    const el = this.boxInput?.nativeElement || this.boxText?.nativeElement;
    const text = this.text || '';
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    this.text = text.slice(0, start) + emoji + text.slice(end);
    this.textChange.emit(this.text);
    this.showEmojiPanel = false;
    setTimeout(() => {
      el?.focus();
      const pos = start + emoji.length;
      try {
        el?.setSelectionRange(pos, pos);
      } catch {}
    }, 0);
  }
}
