import { formatDate, formatNumber } from '../lib/format';
import { latestDate, matchingVariants, searchRules } from '../lib/search';
import type { Filters, SearchRule } from '../lib/search';

const container = document.querySelector<HTMLElement>('.catalog')!;
const input = document.querySelector<HTMLInputElement>('#query')!;
const type = document.querySelector<HTMLSelectElement>('#rule-type')!;
const sort = document.querySelector<HTMLSelectElement>('#sort')!;
const archived = document.querySelector<HTMLInputElement>('#include-archived')!;
const results = document.querySelector<HTMLElement>('#results')!;
const count = document.querySelector<HTMLElement>('#result-count')!;
const empty = document.querySelector<HTMLElement>('#empty')!;
const error = document.querySelector<HTMLElement>('#load-error')!;
const pagination = document.querySelector<HTMLElement>('#pagination')!;
const previous = document.querySelector<HTMLButtonElement>('#previous')!;
const next = document.querySelector<HTMLButtonElement>('#next')!;
const clientButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-client]'));
let rules: SearchRule[] = [];
let selectedClient = '';
let page = 1;
const pageSize = 50;
let debounce: ReturnType<typeof setTimeout>;
let loaded = false;

function readParams() {
  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || '';
  selectedClient = clientButtons.some(b => b.dataset.client === params.get('client')) ? params.get('client') || '' : '';
  type.value = params.get('type') || '';
  sort.value = params.get('sort') || 'updated';
  if (!sort.value) sort.value = 'updated';
  archived.checked = params.get('archived') === '1';
  page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
}
const filters = (): Filters => ({ query: input.value, client: selectedClient, type: type.value, sort: sort.value, archived: archived.checked });
function updateUrl(push = false) {
  const url = new URL(location.href);
  url.search = '';
  if (input.value.trim()) url.searchParams.set('q', input.value.trim());
  if (selectedClient) url.searchParams.set('client', selectedClient);
  if (type.value) url.searchParams.set('type', type.value);
  if (sort.value !== 'updated') url.searchParams.set('sort', sort.value);
  if (archived.checked) url.searchParams.set('archived', '1');
  if (page > 1) url.searchParams.set('page', String(page));
  if (url.href !== location.href) history[push ? 'pushState' : 'replaceState']({}, '', url);
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function render() {
  if (!loaded) return;
  const selection = filters();
  const matches = searchRules(rules, selection);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  page = Math.min(page, pages);
  clientButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.client === selectedClient)));
  results.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const rule of matches.slice((page - 1) * pageSize, page * pageSize)) {
    const variants = matchingVariants(rule, selection);
    const row = element('div', 'rule-row'); row.setAttribute('role', 'row');
    const nameCell = element('div', 'rule-name-cell'); nameCell.setAttribute('role', 'cell');
    const monogram = element('span', 'rule-monogram', rule.name.slice(0, 2).toUpperCase()); monogram.setAttribute('aria-hidden', 'true');
    const names = element('div', 'rule-names');
    const href = `${container.dataset.base}/rules/${encodeURIComponent(rule.id)}/${selectedClient ? '#' + selectedClient : ''}`;
    const title = element('a', 'rule-name', rule.name); title.href = href; title.title = rule.name;
    names.append(title, element('span', 'rule-chinese', rule.chineseName && rule.chineseName !== rule.name ? rule.chineseName : variants[0]?.description.slice(0, 65) || '分流规则集'));
    nameCell.append(monogram, names);
    const clients = element('div', 'client-badges'); clients.setAttribute('role', 'cell');
    for (const variant of variants) {
      const badge = element('span', `client-badge ${variant.client.toLowerCase()}${variant.archived ? ' archived' : ''}`, variant.client);
      if (variant.archived) badge.title = '源站已下架，保留最后备份';
      clients.append(badge);
    }
    const counts = variants.map(v => v.totalLineCount).filter((v): v is number => v != null);
    const minimum = counts.length ? Math.min(...counts) : null;
    const maximum = counts.length ? Math.max(...counts) : null;
    const lines = element('div', 'rule-lines', minimum !== maximum ? `${formatNumber(minimum)}–${formatNumber(maximum)}` : formatNumber(maximum));
    lines.setAttribute('role', 'cell'); lines.title = variants.map(v => `${v.client}: ${formatNumber(v.totalLineCount)} 条`).join('\n');
    const updated = element('div', 'rule-date'); updated.setAttribute('role', 'cell');
    const sourceAt = latestDate(variants.map(v => v.sourceUpdatedAt));
    const time = element('time', '', formatDate(sourceAt));
    if (sourceAt) time.dateTime = sourceAt;
    updated.append(time, element('span', 'date-note', '源站规则更新'));
    const action = element('div', 'rule-action'); action.setAttribute('role', 'cell');
    const detail = element('a', 'detail-link', '查看规则'); detail.href = href; detail.setAttribute('aria-label', `查看 ${rule.chineseName || rule.name} 规则详情`);
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 24 24'); arrow.setAttribute('width', '16'); arrow.setAttribute('height', '16'); arrow.setAttribute('fill', 'none'); arrow.setAttribute('stroke', 'currentColor'); arrow.setAttribute('stroke-width', '1.7'); arrow.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M5 12h14m-6-6 6 6-6 6'); arrow.append(path); detail.append(arrow); action.append(detail);
    row.append(nameCell, clients, lines, updated, action); fragment.append(row);
  }
  results.append(fragment); results.setAttribute('aria-busy', 'false');
  const from = matches.length ? (page - 1) * pageSize + 1 : 0;
  count.replaceChildren(element('strong', '', formatNumber(matches.length)), document.createTextNode(` 个规则${selectedClient ? ' · ' + selectedClient : ' · 已合并相同规则'}`));
  empty.hidden = matches.length !== 0;
  error.hidden = true;
  document.querySelector<HTMLElement>('.table-head')!.hidden = !matches.length;
  pagination.hidden = !matches.length;
  document.querySelector('#page-info')!.textContent = `${from}–${Math.min(page * pageSize, matches.length)} / ${formatNumber(matches.length)} · 第 ${page} / ${pages} 页`;
  previous.disabled = page === 1; next.disabled = page === pages;
}
function change(push = false) { page = 1; render(); updateUrl(push); }
async function load() {
  error.hidden = true;
  results.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(container.dataset.searchUrl!, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error('Index unavailable');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid index');
    rules = data; loaded = true; render(); updateUrl();
  } catch {
    results.replaceChildren(); results.setAttribute('aria-busy', 'false'); error.hidden = false; pagination.hidden = true;
    count.textContent = '目录加载失败';
  }
}
readParams();
clientButtons.forEach(button => {
  button.setAttribute('aria-pressed', String(button.dataset.client === selectedClient));
  button.addEventListener('click', () => { selectedClient = button.dataset.client || ''; change(true); });
});
input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => change(), 180); });
document.querySelector('#search-form')!.addEventListener('submit', event => { event.preventDefault(); clearTimeout(debounce); change(true); });
for (const control of [type, sort, archived]) control.addEventListener('change', () => change(true));
document.querySelector('#reset')!.addEventListener('click', () => { input.value = ''; type.value = ''; sort.value = 'updated'; selectedClient = ''; archived.checked = false; change(true); input.focus(); });
previous.addEventListener('click', () => { page--; render(); updateUrl(true); document.querySelector('.results-toolbar')?.scrollIntoView({ block: 'start' }); });
next.addEventListener('click', () => { page++; render(); updateUrl(true); document.querySelector('.results-toolbar')?.scrollIntoView({ block: 'start' }); });
document.querySelector('#retry')!.addEventListener('click', () => { void load(); });
window.addEventListener('popstate', () => { readParams(); render(); });
document.addEventListener('keydown', event => {
  if (event.key === '/' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); input.focus(); }
});
void load();
