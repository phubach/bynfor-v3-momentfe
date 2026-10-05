import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-moment-text', standalone: false,
  template: `<ng-container *ngFor="let segment of segments()"><a *ngIf="segment.kind === 'url'" [href]="segment.text" target="_blank" rel="noopener noreferrer">{{ segment.text }}</a><a *ngIf="segment.kind === 'tag'" routerLink="/social/category-video" [queryParams]="{ tag: segment.text.slice(1) }">{{ segment.text }}</a><span *ngIf="segment.kind === 'mention'" class="text-hl">{{ segment.text }}</span><span *ngIf="segment.kind === 'text'">{{ segment.text }}</span></ng-container>`,
  styles: [`:host{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#1769ff;text-decoration:none}a:hover{text-decoration:underline}.text-hl{color:#1769ff;font-weight:600}`],
})
export class MomentTextComponent {
  @Input() text = '';
  segments(): Array<{ kind: 'text' | 'url' | 'tag' | 'mention'; text: string }> {
    const raw = this.text || '';
    const tokens = /https?:\/\/[^\s<>]+|#[\p{L}\p{N}_-]+|@[\p{L}\p{N}_. -]+/gu;
    const result: Array<{ kind: 'text' | 'url' | 'tag' | 'mention'; text: string }> = [];
    let start = 0;
    for (const match of raw.matchAll(tokens)) {
      const index = match.index || 0;
      if (index > start) result.push({ kind: 'text', text: raw.slice(start, index) });
      result.push({ kind: match[0].startsWith('#') ? 'tag' : match[0].startsWith('@') ? 'mention' : 'url', text: match[0].trimEnd() });
      start = index + match[0].length;
    }
    if (start < raw.length) result.push({ kind: 'text', text: raw.slice(start) });
    return result;
  }
}
