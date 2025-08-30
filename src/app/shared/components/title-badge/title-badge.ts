import { Component, ContentChild, ElementRef, Input, AfterContentInit } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-title-badge',
  standalone: true,
  imports: [NgIf],
  templateUrl: './title-badge.html',
  styleUrl: './title-badge.scss'
})
export class TitleBadge implements AfterContentInit {
  /** 表示テキスト（投影コンテンツがある場合は無視） */
  @Input() text = '';
  /** 余白小さめのコンパクト表示 */
  @Input() compact = false;

  /** ng-content があるかどうかの検出に利用 */
  @ContentChild('projected', { read: ElementRef }) projected?: ElementRef;
  hasProjectedContent = false;

  ngAfterContentInit(): void {
    // ng-content が空かどうかを判定（要素ノードがあればtrue）
    this.hasProjectedContent = !!this.projected;
  }
}

