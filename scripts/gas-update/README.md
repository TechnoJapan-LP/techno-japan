# GAS ハンドラ更新キット — add_article / add_artist 完全対応

CMS から送られる全フィールドをスプレッドシートに保存できるようにする更新です。

## 現状の問題

- `add_article`: CMS は **body / author / tags / status / date** を送っているが、GAS 側の固定列リストに無いため保存されない
- `add_artist`: **imagePosition / website** が保存されない
- `update_row`（編集保存）はヘッダ名マッピング式なので既に全フィールド動作 → 新規作成だけが欠落

## 手順（10分）

### Step 1: スプレッドシートに列を追加

Google スプレッドシートを開き、**1行目（ヘッダ行）の末尾** に列を追加:

| シート | 追加する列ヘッダ |
|--------|----------------|
| `ARTICLES` | `date` |
| `ARTISTS` | `imagePosition`, `website` |

※ ヘッダ名は**大文字小文字までこの通り**に。位置はどこでも良い（末尾推奨）。

### Step 2: GAS エディタでコードを差し替え

1. スプレッドシート → 拡張機能 → Apps Script
2. `Code.gs` 内の既存の `add_article` / `add_artist` 処理を探す
   （`doPost` の中で `action === 'add_article'` を分岐している箇所）
3. 下の **[貼り付けコード]** をファイル末尾に追加
4. `doPost` の分岐を新関数に差し替え:

```javascript
// doPost 内の既存分岐をこう書き換える:
if (data.action === 'add_article') return jsonOut_(addRowByHeaders_('ARTICLES', data));
if (data.action === 'add_artist')  return jsonOut_(addRowByHeaders_('ARTISTS', data));
```

※ 既存コードのレスポンス生成関数が `jsonOut_` でない場合（例: `output(...)` /
`ContentService.createTextOutput(...)`）は、既存の書き方に合わせてください。

### Step 3: 再デプロイ

デプロイ → デプロイを管理 → 編集（鉛筆）→ バージョン「新バージョン」→ デプロイ。
**URL が変わらないよう「デプロイを管理」から更新すること**（新規デプロイにすると
CMS 側の GAS_URL の差し替えが必要になる）。

---

## [貼り付けコード]

```javascript
/**
 * ヘッダ名ベースの汎用行追加。
 * ペイロードのキーとシート1行目のヘッダを（大文字小文字無視で）突き合わせ、
 * 一致した列にだけ値を書く。列の並び順に依存しない。
 * 未知のキーは無視、一致しないヘッダは空欄のまま。
 */
function addRowByHeaders_(sheetName, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Sheet not found: ' + sheetName };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // 大文字小文字を無視してペイロードを引けるようにする
  var lower = {};
  Object.keys(data).forEach(function (k) {
    if (k === 'action') return;
    lower[String(k).toLowerCase()] = data[k];
  });

  var row = headers.map(function (h) {
    var key = String(h).trim().toLowerCase();
    if (key === 'lasteditedat') return new Date().toISOString();
    if (key === 'lasteditedby') return lower['lasteditedby'] || 'cms';
    return (key in lower && lower[key] !== undefined && lower[key] !== null)
      ? lower[key] : '';
  });

  sheet.appendRow(row);
  return { ok: true, row: sheet.getLastRow(), sheet: sheetName };
}
```

---

## 動作確認

1. CMS → Article → New で本文・タグ・ステータス込みの記事を保存
2. スプレッドシートの ARTICLES シートで **body / tags / status / date / author が
   入った新規行** ができていればOK
3. CMS → Artist → New で Image Position を設定して保存 →
   ARTISTS シートに **imagePosition** が入ればOK

## 补足

- この方式なら今後シートに列を足すだけで、CMS→GAS のコード変更なしに
  新フィールドが保存される（CMS のペイロードに同名キーがあれば自動対応）
- 既存の `update_row` はそのままで良い（同じヘッダマッピング思想のはず）
