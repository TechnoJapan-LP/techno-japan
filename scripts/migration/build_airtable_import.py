#!/usr/bin/env python3
"""管理シート（xlsx）→ Airtable 取り込み用 CSV 一式を生成する。

入力:  data/migration/Techno.Japan.xlsx（gitignore 済み・非公開）
出力:  data/migration/out/*.csv ＋ issues.csv（要判断リスト）

■ 設計の要点（docs 化前の暫定メモ）

- 「サイトに載っているものは LP が正」。サイト公開中の96フェス・22会場は
  シートからではなく data.js から editorial として取り込む。
  シート側の同名行は重複としてスキップ（issues.csv に記録）。
- ID（slug）は発行後不変。名前が非ASCIIで slug が作れないものは
  needs_review に落とし、ここでは無理に発行しない。
- 日付は date_precision 付きで変換。パースできないものは
  壊さず issues.csv へ（元の文字列を温存）。
- 元の値は *_raw 列に必ず残す（事実主義: 変換で情報を捨てない）。

使い方: python3 scripts/migration/build_airtable_import.py
"""
import csv
import json
import re
import subprocess
import unicodedata
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / 'data/migration/Techno.Japan.xlsx'
OUT = ROOT / 'data/migration/out'
OUT.mkdir(parents=True, exist_ok=True)

# ---- 語彙の変換表（2026-08-19 ユーザー確定）----
GENRE_MAP = {
    'techno': ['TECHNO'], 'house': ['HOUSE'], 'deep': ['DEEP TECHNO'],
    'hard': ['HARD TECHNO'], 'melodic': ['MELODIC TECHNO'],
    'ambient': ['AMBIENT'], 'trance': ['TRANCE'], 'psychedelic': ['PSYTRANCE'],
    'live': ['LIVE'], 'band': ['LIVE'], 'bass': ['BASS'], 'edm': ['EDM'],
    # ジャンルではない語 → 特徴タグへ
    'digital art': ('FEATURE', 'DIGITAL ART'),
    'consepting': ('FEATURE', 'CONCEPTUAL'),
    'concepting': ('FEATURE', 'CONCEPTUAL'),
    # 判定不能 → 空＋要判定（AI 巡回の初期タスク）
    'mix': None,
}

COUNTRIES = {  # Location の末尾一致で国を判定（主要どころ。未一致は issues へ）
    'japan': 'JP', 'germany': 'DE', 'france': 'FR', 'netherlands': 'NL',
    'uk': 'GB', 'united kingdom': 'GB', 'england': 'GB', 'scotland': 'GB',
    'portugal': 'PT', 'croatia': 'HR', 'italy': 'IT', 'spain': 'ES',
    'belgium': 'BE', 'usa': 'US', 'united states': 'US', 'america': 'US',
    'australia': 'AU', 'austria': 'AT', 'switzerland': 'CH', 'poland': 'PL',
    'czech republic': 'CZ', 'czechia': 'CZ', 'hungary': 'HU', 'romania': 'RO',
    'bulgaria': 'BG', 'serbia': 'RS', 'georgia': 'GE', 'greece': 'GR',
    'turkey': 'TR', 'thailand': 'TH', 'indonesia': 'ID', 'bali': 'ID',
    'india': 'IN', 'vietnam': 'VN', 'taiwan': 'TW', 'south korea': 'KR',
    'korea': 'KR', 'china': 'CN', 'mexico': 'MX', 'brazil': 'BR',
    'argentina': 'AR', 'chile': 'CL', 'colombia': 'CO', 'peru': 'PE',
    'canada': 'CA', 'morocco': 'MA', 'south africa': 'ZA', 'egypt': 'EG',
    'israel': 'IL', 'uae': 'AE', 'dubai': 'AE', 'georgia': 'GE',
    'denmark': 'DK', 'sweden': 'SE', 'norway': 'NO', 'finland': 'FI',
    'iceland': 'IS', 'ireland': 'IE', 'slovakia': 'SK', 'slovenia': 'SI',
    'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE', 'ukraine': 'UA',
    'montenegro': 'ME', 'albania': 'AL', 'malta': 'MT', 'cyprus': 'CY',
    'luxembourg': 'LU', 'monaco': 'MC', 'tunisia': 'TN', 'singapore': 'SG',
    'malaysia': 'MY', 'philippines': 'PH', 'new zealand': 'NZ',
}
REGION = {'JP':'Asia','TH':'Asia','ID':'Asia','IN':'Asia','VN':'Asia','TW':'Asia','KR':'Asia','CN':'Asia','SG':'Asia','MY':'Asia','PH':'Asia','IL':'MEA','AE':'MEA','TR':'MEA','EG':'MEA','MA':'MEA','ZA':'MEA','TN':'MEA','US':'Americas','CA':'Americas','MX':'Americas','BR':'Americas','AR':'Americas','CL':'Americas','CO':'Americas','PE':'Americas','AU':'Oceania','NZ':'Oceania'}

issues = []          # [表, 名前, 種類, 詳細]
def issue(tab, name, kind, detail=''):
    issues.append([tab, name, kind, detail])

def norm_name(s):
    s = unicodedata.normalize('NFKC', s).lower()
    s = re.sub(r'\s+', ' ', s).strip()
    return re.sub(r'\b(festival|fest|the)\b', '', s).strip()

def slugify(name):
    s = unicodedata.normalize('NFKD', name)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    # 英字3文字以上を要求。数字だけを許すと「アイトイシキ2025」等の
    # 日本語名フェスが全部 slug="2025" になって衝突する（実データで3件発生）
    return s if len(re.sub(r'[^a-z]', '', s)) >= 3 else ''

def parse_date(raw):
    """→ (start, end, precision) いずれも ISO 文字列。失敗は (None,None,None)。"""
    d = raw.replace('〜', '-').replace('–', '-').strip()
    if not d or d == '-':
        return None, None, None
    m = re.match(r'^(20\d\d)\.(\d{1,2})\.(\d{1,2})-(20\d\d)\.(\d{1,2})\.(\d{1,2})$', d)
    if m:
        y1,mo1,d1,y2,mo2,d2 = map(int, m.groups())
        return f'{y1:04d}-{mo1:02d}-{d1:02d}', f'{y2:04d}-{mo2:02d}-{d2:02d}', 'confirmed'
    m = re.match(r'^(20\d\d)\.(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})$', d)
    if m:
        y,mo1,d1,mo2,d2 = map(int, m.groups())
        return f'{y:04d}-{mo1:02d}-{d1:02d}', f'{y:04d}-{mo2:02d}-{d2:02d}', 'confirmed'
    m = re.match(r'^(20\d\d)\.(\d{1,2})\.(\d{1,2})-(\d{1,2})$', d)
    if m:
        y,mo,d1,d2 = map(int, m.groups())
        return f'{y:04d}-{mo:02d}-{d1:02d}', f'{y:04d}-{mo:02d}-{d2:02d}', 'confirmed'
    m = re.match(r'^(20\d\d)\.(\d{1,2})\.(\d{1,2})$', d)
    if m:
        y,mo,dd = map(int, m.groups())
        return f'{y:04d}-{mo:02d}-{dd:02d}', f'{y:04d}-{mo:02d}-{dd:02d}', 'confirmed'
    m = re.match(r'^(20\d\d)\.(\d{1,2})$', d)
    if m:
        y,mo = map(int, m.groups())
        return f'{y:04d}-{mo:02d}-01', None, 'month-only'
    return None, None, None

def parse_location(loc, default_country=None):
    """'Berlin, Germany' / 'Germany' / 'Tokyo' → (country, city)"""
    if not loc:
        return default_country, ''
    parts = [p.strip() for p in loc.split(',')]
    tail = parts[-1].lower()
    if tail in COUNTRIES:
        return COUNTRIES[tail], ', '.join(parts[:-1])
    if default_country:
        return default_country, loc
    return None, loc

def map_genre(raw):
    # data.js（サイト側）は配列、シート側は文字列。両方受ける
    if isinstance(raw, (list, tuple)):
        raw = ','.join(str(x) for x in raw)
    raw = str(raw or '')
    genres, feats, unknown = [], [], []
    needs = False
    for t in re.split(r'[,、/・]+', raw):
        t = t.strip().lower()
        if not t: continue
        hit = GENRE_MAP.get(t)
        if hit is None and t in GENRE_MAP:          # 'mix'
            needs = True
        elif isinstance(hit, tuple):
            feats.append(hit[1]); needs = True       # 特徴タグ行はジャンル未定
        elif isinstance(hit, list):
            genres.extend(hit)
        else:
            unknown.append(t); needs = True
    return sorted(set(genres)), sorted(set(feats)), needs, unknown

def sheet_rows(wb, tab):
    ws = wb[tab]; it = ws.iter_rows(values_only=True)
    header = [str(c).strip() if c else '' for c in next(it)]
    for r in it:
        d = {header[i]: (str(v).strip() if v is not None else '') for i, v in enumerate(r) if i < len(header)}
        if d.get('Name'):
            yield d

def site_data():
    js = subprocess.run(['node', '-e', '''
const fs=require("fs");const sb={};
new Function("window",fs.readFileSync("LP/data.js","utf8")+`
 window.__d={F:typeof FESTIVALS!=="undefined"?FESTIVALS:[],V:typeof VENUES!=="undefined"?VENUES:[]}`)(sb);
console.log(JSON.stringify(sb.__d));'''], capture_output=True, text=True, cwd=ROOT)
    return json.loads(js.stdout)

def write_csv(path, header, rows):
    with open(path, 'w', newline='', encoding='utf-8-sig') as f:  # BOM: Airtable/Excel 両対応
        w = csv.writer(f); w.writerow(header); w.writerows(rows)
    print(f'  {path.name:<22} {len(rows)}行')

def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    site = site_data()
    used_slugs = {}

    def unique_slug(name, country):
        base = slugify(name)
        if not base:
            return ''
        s = base
        if s in used_slugs:
            # 同名でも別行なら別レコード（国違いの同名フェスがある: Unsound 等）。
            # まず国コード、それでも衝突したら連番。必ず一意にする
            s = f'{base}-{(country or "xx").lower()}'
            n = 2
            while s in used_slugs:
                s = f'{base}-{(country or "xx").lower()}-{n}'; n += 1
            issue('slug', name, '同名slugを分離', s)
        used_slugs[s] = name
        return s

    # ---------- Festivals ----------
    F_HEADER = ['Name','festival_id','coverage_tier','on_site','country','region','city_region',
                'genres','features','genre_raw','brand_status','instagram','official_url',
                'last_date_start','last_date_end','date_precision','date_raw',
                'needs_review','source_tab','notes','confidence']
    fest_rows = []
    site_names = set()

    for f in site['F']:                                   # ① サイト公開中96件（正は LP）
        site_names.add(norm_name(f['name']))
        used_slugs[f['id']] = f['name']
        g, feats, _, _ = map_genre(f.get('genre',''))
        graw = f.get('genre','')
        if isinstance(graw, (list, tuple)): graw = ','.join(map(str, graw))
        fest_rows.append([f['name'], f['id'], 'editorial', 'checked', 'JP', 'Asia',
                          f.get('city',''), ','.join(g), ','.join(feats), graw,
                          'active', f.get('instagram',''), f.get('url',''),
                          '', '', '', '', '', 'LP(site)', 'master=LPシート。詳細はサイト/CMSで管理', 'high'])

    def import_fest(tab, default_country):
        seen = {}
        for r in sheet_rows(wb, tab):
            name = r['Name']
            key = norm_name(name)
            if key in site_names:
                if default_country == 'JP':
                    issue(tab, name, 'サイト重複スキップ', 'LPが正')
                    continue
                # 海外タブの同名は別フェスの可能性（ODYSSEY 宮崎 vs 海外 ODYSSEY）。
                # 消さずに取り込み、要確認フラグを付ける
                issue(tab, name, 'サイト掲載と同名・要確認', '別フェスか確認')
            if key in seen:
                issue(tab, name, 'タブ内重複スキップ', f'既出「{seen[key]}」')
                continue
            seen[key] = name
            country, city = parse_location(r.get('Location',''), default_country)
            if not country:
                issue(tab, name, '国が判定できない', r.get('Location',''))
            ds, de, prec = parse_date(r.get('Date',''))
            if r.get('Date','').strip() not in ('','-') and not ds:
                issue(tab, name, '日付パース不能', r.get('Date',''))
            g, feats, gneeds, unknown = map_genre(r.get('Genre',''))
            for u in unknown:
                issue(tab, name, '未知のジャンル語', u)
            slug = unique_slug(name, country)
            if not slug:
                issue(tab, name, 'slug発行不能(非ASCII)', '昇格時に手動発行')
            year = int(ds[:4]) if ds else None
            status = 'active' if (year and year >= 2026) else 'unknown'
            review = ';'.join(filter(None, [
                'genre' if gneeds or unknown else '',
                'country' if not country else '',
                'date' if (r.get('Date','').strip() not in ('','-') and not ds) else '',
                'slug' if not slug else '']))
            fest_rows.append([name, slug, 'directory', '', country or '', REGION.get(country,'Europe') if country else '',
                              city, ','.join(g), ','.join(feats), r.get('Genre',''),
                              status, r.get('URL',''), '',
                              ds or '', de or '', prec or '', r.get('Date',''),
                              review, tab, r.get('Comment','') or r.get('紹介',''), 'low'])

    import_fest('Festival', 'JP')                          # ② 日本・未掲載分
    import_fest('Festival(W)', None)                       # ③ 海外727件

    write_csv(OUT/'festivals.csv', F_HEADER, fest_rows)

    # ---------- Venues ----------
    V_HEADER = ['Name','venue_id','venue_type','coverage_tier','on_site','country','city',
                'instagram','official_url','venue_status','needs_review','source_tab','notes','confidence']
    ven_rows = []
    vseen = set()
    for v in site['V']:
        vseen.add(norm_name(v['name']))
        used_slugs[v['id']] = v['name']
        ven_rows.append([v['name'], v['id'], v.get('type','club').lower() or 'club', 'editorial','checked',
                         'JP', v.get('city',''), v.get('instagram',''), v.get('url',''),
                         'open', '', 'LP(site)', 'master=LPシート', 'high'])
    for tab, vtype, cc in [('Club','club','JP'),('Bar','bar','JP'),('Record','record-shop','JP'),
                            ('Club(W)','club',None),('Bar(W)','bar',None),('Record(W)','record-shop',None)]:
        seen = set()
        for r in sheet_rows(wb, tab):
            key = norm_name(r['Name'])
            if key in vseen and vtype == 'club':
                issue(tab, r['Name'], 'サイト重複スキップ', 'LPが正'); continue
            if key in seen:
                issue(tab, r['Name'], 'タブ内重複スキップ'); continue
            seen.add(key)
            country, city = parse_location(r.get('Location',''), cc)
            if not country: issue(tab, r['Name'], '国が判定できない', r.get('Location',''))
            slug = unique_slug(r['Name'], country)
            review = ';'.join(filter(None, ['country' if not country else '', 'slug' if not slug else '']))
            ven_rows.append([r['Name'], slug, vtype, 'directory','', country or '', city,
                             r.get('URL',''), '', 'open', review, tab, r.get('Comment',''), 'low'])
    write_csv(OUT/'venues.csv', V_HEADER, ven_rows)

    # ---------- Promoters ----------
    P_HEADER = ['Name','promoter_id','country','city','instagram','linked_festivals','events_raw','notes','confidence']
    fest_by_norm = {norm_name(r[0]): r[0] for r in fest_rows}
    pro_rows = []
    for r in sheet_rows(wb, 'Promoter(W)'):
        country, city = parse_location(r.get('Location',''), None)
        events = [r.get(f'Event{i}','') for i in range(1,6)]
        linked, unmatched = [], []
        for e in filter(None, events):
            hit = fest_by_norm.get(norm_name(e))
            (linked if hit else unmatched).append(hit or e)
        pro_rows.append([r['Name'], unique_slug(r['Name'], country), country or '', city,
                         r.get('URL',''), ','.join(linked), ' / '.join(filter(None,events)),
                         (r.get('Comment','') + (' | 未照合: '+', '.join(unmatched) if unmatched else '')).strip(' |'),
                         'low'])
    write_csv(OUT/'promoters.csv', P_HEADER, pro_rows)

    # ---------- Media ----------
    M_HEADER = ['Name','media_id','area','genres','instagram','followers','notes','confidence']
    med_rows = []
    for r in sheet_rows(wb, 'Media'):
        fol = re.sub(r'[^\d]', '', r.get('フォロワー',''))
        g, _, _, _ = map_genre(r.get('Genre',''))
        med_rows.append([r['Name'], unique_slug(r['Name'], None), r.get('エリア',''),
                         ','.join(g) or r.get('Genre',''), r.get('URL',''), fol or '', r.get('備考',''), 'low'])
    write_csv(OUT/'media.csv', M_HEADER, med_rows)

    # ---------- Editions（日付が取れた directory フェスのみ）----------
    E_HEADER = ['edition_id','Festival','year','date_start','date_end','date_precision',
                'edition_status','source_tab','confidence']
    ed_rows = []
    for r in fest_rows:
        name, slug, tier = r[0], r[1], r[2]
        ds, de, prec = r[13], r[14], r[15]
        if tier != 'directory' or not ds or not slug:
            continue
        year = ds[:4]
        status = 'finished' if ds < '2026-08-19' else 'announced'
        ed_rows.append([f'{slug}-{year}', name, year, ds, de, prec, status, r[18], 'low'])
    write_csv(OUT/'editions.csv', E_HEADER, ed_rows)

    # ---------- issues / pilot ----------
    write_csv(OUT/'issues.csv', ['タブ','名前','種類','詳細'], issues)
    pilot = [r for r in fest_rows if r[2]=='directory'][:35] + \
            [r for r in fest_rows if r[17]][:15]           # 問題ありを15件混ぜる
    write_csv(OUT/'pilot_festivals.csv', F_HEADER, pilot[:50])

    # ---------- 検証サマリ ----------
    n_dir = sum(1 for r in fest_rows if r[2]=='directory')
    n_date = sum(1 for r in fest_rows if r[13])
    n_review = sum(1 for r in fest_rows if r[17])
    kinds = Counter(i[2] for i in issues)
    print(f'\n検証: Festivals {len(fest_rows)}行（editorial 96 / directory {n_dir}）')
    print(f'      日付変換成功 {n_date}/{n_dir}  要判断 {n_review}件')
    print(f'      issues 内訳: {dict(kinds)}')
    assert len({r[1] for r in fest_rows if r[1]}) == len([r for r in fest_rows if r[1]]), 'slug 重複'
    print('      ✅ slug 一意性 OK')

if __name__ == '__main__':
    main()
