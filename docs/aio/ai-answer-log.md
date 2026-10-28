# AI 回答ログ — 質問集と記録の手順（2026-10-28 作成）

TECHNO JAPAN が ChatGPT・Google の AI モード・Gemini・Perplexity の答えに出るかを、毎月同じ質問で記録する。
記録はユーザー専用のページ（claude.ai のアーティファクト「TECHNO JAPAN AI回答ログ」 https://claude.ai/artifact/1hHBW51iJjWu2qpiJ2xt15 、非公開）に保存し、Claude は `ArtifactData`（collection `answers` / `months`）で読める。

## 手順

- **毎月（約20分）**: ★の10問（日本語5・英語5）を ChatGPT と Google AI モードで聞く。
- **3か月ごと（1・4・7・10月）**: 全40問を、Gemini と Perplexity も含めた4つで聞く。
- **毎月の数字**: Search Console の「生成 AI」レポートの表示回数（ユーザー）、AI 経由のセッション（GA4、`reports/ai-referrals.md` から Claude が入れる）。
- 50問未満なので、数字は傾向を見るための「探索的」なもの（IAB「Measuring Visibility in the AI Era」の基準）。AI の更新で一斉に変わったら、その月から別の流れとして見る。

## 聞き方のルール

1. 毎回、新しい会話で聞く（前の会話の続きにしない）。ChatGPT は検索が使える状態で。
2. 質問はコピーしてそのまま貼る（言い回しを変えない）。
3. techno-japan.media へのリンクがあれば「リンク付き」、名前だけなら「名前だけ」、出なければ「出なかった」。
4. 引用されたページの URL を記録する。
5. 日付・場所・出演者・TECHNO JAPAN の説明に間違いがあれば「誤り」に書く → Claude が該当ページに正しい事実を書いて直す。
6. **Google の AI モードは手で聞く。** Google の検索結果を自動ツールで集めるのはスパムポリシー・利用規約の違反。

## 質問集（40問）

### 日本語

| ID | 意図 | 毎月 | 質問 |
|---|---|---|---|
| ja-i1 | 情報 | ★ | 日本のテクノシーンを専門に扱うウェブメディアを教えて |
| ja-i2 | 情報 |  | The Labyrinth（ラビリンス）はどんなフェス？ |
| ja-i3 | 情報 |  | FESTIVAL de FRUE はどんなフェス？ |
| ja-i4 | 情報 |  | 渋谷の WOMB はどんなクラブ？ |
| ja-i5 | 情報 |  | 電気菩薩（DENKI BODHISATTVA）とは何？ |
| ja-c1 | 比較 | ★ | 東京で音響がいいテクノクラブを比較して |
| ja-c2 | 比較 |  | 日本の野外レイヴとヨーロッパのテクノフェスの違いは？ |
| ja-c3 | 比較 |  | りんご音楽祭と FESTIVAL de FRUE の違いは？ |
| ja-c4 | 比較 |  | 日本のテクノフェスを規模と雰囲気で比べて |
| ja-c5 | 比較 |  | 大阪と東京のクラブシーンの違いは？ |
| ja-r1 | おすすめ | ★ | 2026年に日本で開催されるテクノの野外フェスのおすすめは？ |
| ja-r2 | おすすめ |  | 初めて行く人におすすめの日本の野外テクノフェスは？ |
| ja-r3 | おすすめ |  | 大阪でおすすめのテクノクラブは？ |
| ja-r4 | おすすめ |  | 長野や群馬の山で開催される野外レイヴのおすすめは？ |
| ja-r5 | おすすめ |  | 今注目されている日本のテクノ DJ は？ |
| ja-a1 | 行動 | ★ | 日本のテクノ・ハウスのフェスの日程を一覧で見られるサイトは？ |
| ja-a2 | 行動 | ★ | 今月、日本で行けるテクノのイベントを教えて |
| ja-a3 | 行動 |  | The Labyrinth のチケットはどこで買える？ |
| ja-a4 | 行動 |  | 東京のテクノクラブの場所や営業時間を調べるには？ |
| ja-a5 | 行動 |  | 日本のフェスの出演者を調べられるサイトは？ |

### English

| ID | 意図 | 毎月 | 質問 |
|---|---|---|---|
| en-i1 | 情報 | ★ | What websites cover Japan's underground techno scene? |
| en-i2 | 情報 |  | What is The Labyrinth festival in Japan? |
| en-i3 | 情報 |  | What is FESTIVAL de FRUE? |
| en-i4 | 情報 |  | What kind of club is WOMB in Shibuya? |
| en-i5 | 情報 |  | What is DENKI BODHISATTVA? |
| en-c1 | 比較 | ★ | Which Tokyo techno clubs have the best sound systems? |
| en-c2 | 比較 |  | How do Japanese open-air raves compare to European techno festivals? |
| en-c3 | 比較 |  | What is the difference between RINGO FES. and FESTIVAL de FRUE? |
| en-c4 | 比較 |  | Compare techno festivals in Japan by size and atmosphere. |
| en-c5 | 比較 |  | How does the Osaka club scene differ from Tokyo's? |
| en-r1 | おすすめ | ★ | What are the best open-air techno festivals in Japan in 2026? |
| en-r2 | おすすめ |  | What is the best techno festival in Japan for a first-timer? |
| en-r3 | おすすめ |  | What are the best techno clubs in Osaka? |
| en-r4 | おすすめ |  | Are there underground raves in the mountains of Nagano or Gunma? |
| en-r5 | おすすめ |  | Who are the Japanese techno DJs to watch right now? |
| en-a1 | 行動 | ★ | Where can I find a calendar of techno festivals in Japan? |
| en-a2 | 行動 | ★ | What techno events can I go to in Japan this month? |
| en-a3 | 行動 |  | Where can I buy tickets for The Labyrinth? |
| en-a4 | 行動 |  | How do I find addresses and opening hours for Tokyo techno clubs? |
| en-a5 | 行動 |  | Where can I check the lineups of festivals in Japan? |

## 記録の形（アーティファクトの db）

- `answers/<月>__<AI>__<質問ID>`: `{month, ai, qid, r: link|name|none, url, err, memo, at}`（AI は chatgpt / aimode / gemini / perplexity）
- `months/<月>`: `{month, gscImpressions, aiSessions, notes, at}`
