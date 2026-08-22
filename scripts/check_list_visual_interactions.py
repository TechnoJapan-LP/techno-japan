#!/usr/bin/env python3
"""一覧ビジュアル案のフィルタ・通常リンク・欠損画像をChromeで確認する。"""
import argparse, json, os, random, socket, subprocess, tempfile, time, urllib.request, shutil
from pathlib import Path
from measure_list_visuals import CDP, LocalServer, CHROME

def open_browser(url):
    profile=tempfile.mkdtemp(prefix='tj-list-check-'); port=random.randint(39000,49000)
    p=subprocess.Popen([CHROME,'--headless=new','--disable-gpu','--no-sandbox','--no-first-run',f'--user-data-dir={profile}',f'--remote-debugging-port={port}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    deadline=time.time()+15; tabs=[]
    while time.time()<deadline:
        try:
            tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list'))
            tabs=[t for t in tabs if t.get('type')=='page' and not t.get('url','').startswith('chrome-extension://')]
            if tabs: break
        except Exception: time.sleep(.1)
    c=CDP(tabs[0]['webSocketDebuggerUrl']); c.call('Page.enable'); c.call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':2,'mobile':True}); c.call('Page.navigate',{'url':url}); time.sleep(4)
    return p, profile, c

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',required=True); ap.add_argument('--state',required=True,choices=['before','A','B']); args=ap.parse_args()
    with LocalServer(Path(args.root)) as srv:
        results=[]
        for lang in ('ja','en'):
            q='' if args.state=='before' else f'?visual={args.state.lower()}'
            p,profile,c=open_browser(f'http://127.0.0.1:{srv.port}/'+('' if lang=='ja' else 'en/')+'festivals.html'+q)
            try:
                base=json.loads(c.eval("""(()=>{const rows=[...document.querySelectorAll('.festival-row')];const first=rows.find(r=>getComputedStyle(r).display!=='none');document.documentElement.style.scrollBehavior='auto';if(first)document.scrollingElement.scrollTop=first.getBoundingClientRect().top+document.scrollingElement.scrollTop;return JSON.stringify({rows:rows.length,visible:rows.filter(r=>{const x=r.getBoundingClientRect();return x.height>0&&x.top>=0&&x.bottom<=innerHeight}).length,images:rows.filter(r=>r.querySelector('.festival-row-visual')).length,noImage:rows.filter(r=>!r.querySelector('.festival-row-visual')).length,staticLinks:rows.every(r=>r.querySelector('a.festival-card-link')?.getAttribute('href')?.startsWith(location.pathname.startsWith('/en/')?'/en/festivals/':'/festivals/'))})})()"""))
                chip=c.eval("document.querySelector('.fest-filter-chip:not(.active)')?.textContent||''")
                c.eval("document.querySelector('.fest-filter-chip:not(.active)')?.click()")
                time.sleep(.5)
                filt=json.loads(c.eval("""(()=>{const rows=[...document.querySelectorAll('.festival-row')].filter(r=>getComputedStyle(r).display!=='none');return JSON.stringify({rows:rows.length,visualConsistency:rows.every(r=>{const f=FESTIVALS.find(x=>x.id===r.dataset.festId);return Boolean(f?.image)===Boolean(r.querySelector('.festival-row-visual'))})})})()"""))
                nav=json.loads(c.eval("""(()=>{const a=document.querySelector('.festival-card-link');a?.click();return JSON.stringify({href:a?.getAttribute('href')||'',onclick:a?.getAttribute('onclick')||null})})()""")); time.sleep(.7)
                results.append({'state':args.state,'page':'festivals','lang':lang,'filter':chip,'base':base,'afterFilter':filt,'link':nav,'navigated':c.eval("location.pathname.startsWith(location.pathname.startsWith('/en/')?'/en/festivals/':'/festivals/')")})
            finally:
                c.close(); p.terminate(); p.wait(timeout=5); shutil.rmtree(profile,ignore_errors=True)
        p,profile,c=open_browser(f'http://127.0.0.1:{srv.port}/venues.html')
        try:
            venue=json.loads(c.eval("""(()=>{const cards=[...document.querySelectorAll('.venue-card')];return JSON.stringify({cards:cards.length,images:cards.filter(x=>x.querySelector('.venue-card-visual')).length,noImage:cards.filter(x=>!x.querySelector('.venue-card-visual')).length,staticLinks:cards.every(x=>x.getAttribute('href')?.startsWith('/venues/'))})})()"""))
            c.eval("const i=document.querySelector('#venues-search');i.value='WOMB';i.dispatchEvent(new Event('input',{bubbles:true}))"); time.sleep(.5)
            venue['searchRows']=c.eval("document.querySelectorAll('.venue-card:not([style*=\"display: none\"])').length")
            results.append({'state':args.state,'page':'venues','lang':'ja','search':'WOMB','result':venue})
        finally:
            c.close(); p.terminate(); p.wait(timeout=5); shutil.rmtree(profile,ignore_errors=True)
    print(json.dumps(results,ensure_ascii=False))
if __name__=='__main__': main()
