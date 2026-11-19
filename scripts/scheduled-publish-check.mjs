#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildNow, parsePublishAt } from './article-visibility.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
};

export function dueScheduledArticles(articles, now) {
  const lower = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return (articles || []).filter((article) => {
    if (String(article?.status || '').trim().toLowerCase() !== 'scheduled') return false;
    const at = parsePublishAt(article.publishAt);
    return at && at > lower && at <= now;
  });
}

export function shouldTrigger(articles, now, runs) {
  const due = dueScheduledArticles(articles, now);
  if (!due.length) return { trigger: false, reason: '公開時刻を迎えた予約記事はありません' };
  const latest = due.map((article) => parsePublishAt(article.publishAt)).sort((a, b) => b - a)[0];
  const covered = (runs || []).some((run) => {
    const created = new Date(run.createdAt || 0);
    return !Number.isNaN(created.getTime()) && created >= latest;
  });
  return covered
    ? { trigger: false, reason: `publishAt以降のPublish pipeline runがあります (${latest.toISOString()})`, latest }
    : { trigger: true, reason: `予約記事の公開時刻を過ぎています (${latest.toISOString()})`, latest };
}

function loadArticles(file) {
  const context = {};
  vm.createContext(context);
  new vm.Script(`${fs.readFileSync(file, 'utf8')}\n;globalThis.__articles=ARTICLES;`).runInContext(context);
  return context.__articles || [];
}

function loadRuns(file) { return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; }

function main() {
  const nowRaw = arg('--now');
  const now = nowRaw ? new Date(nowRaw) : buildNow();
  if (Number.isNaN(now.getTime())) throw new Error(`--now が不正です: ${nowRaw}`);
  const articles = loadArticles(arg('--data') || path.join(ROOT, 'LP/data.js'));
  let runs = loadRuns(arg('--runs'));
  if (!runs) {
    const output = execFileSync('gh', ['run', 'list', '--workflow', 'Publish pipeline', '--limit', '30', '--json', 'createdAt,status,conclusion'], { cwd: ROOT, encoding: 'utf8' });
    runs = JSON.parse(output);
  }
  const result = shouldTrigger(articles, now, runs);
  console.log(`${result.trigger ? '起動対象' : '待機'}: ${result.reason}`);
  if (result.trigger && !process.argv.includes('--dry-run')) {
    execFileSync('gh', ['workflow', 'run', 'Publish pipeline'], { cwd: ROOT, stdio: 'inherit' });
    console.log('Publish pipeline を1回起動しました');
  } else if (result.trigger) {
    console.log('--dry-run のため起動しません');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
