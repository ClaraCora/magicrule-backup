const notice = document.querySelector<HTMLElement>('#notice');
let noticeTimeout: ReturnType<typeof setTimeout>;
const copyFeedback = new WeakMap<HTMLButtonElement, { label: string; timer?: ReturnType<typeof setTimeout> }>();
function announce(message: string) {
  if (!notice) return;
  clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimeout = setTimeout(() => { notice.hidden = true; }, 4500);
}

function updateHealth() {
  document.querySelectorAll<HTMLElement>('[data-sync-at]').forEach(element => {
    const elapsed = Date.now() - Date.parse(element.dataset.syncAt || '');
    const overdue = elapsed > 36 * 3600 * 1000;
    element.classList.toggle('overdue', overdue);
    const label = element.querySelector('[data-health-label]');
    if (label) label.textContent = overdue ? '同步已逾期 · 上次成功' : '最近同步成功';
  });
}
updateHealth();
setInterval(updateHealth, 60_000);

document.addEventListener('click', async event => {
  const target = event.target as Element;
  const copy = target.closest<HTMLButtonElement>('[data-copy]');
  if (copy && !copy.disabled) {
    let feedback = copyFeedback.get(copy);
    if (!feedback) { feedback = { label: copy.innerHTML }; copyFeedback.set(copy, feedback); }
    const copiedUrl = copy.dataset.copy || '';
    const copiedLabel = copy.dataset.copyLabel;
    try {
      await navigator.clipboard.writeText(copiedUrl);
      if (copy.dataset.copy !== copiedUrl) return;
      clearTimeout(feedback.timer);
      copy.textContent = '已复制';
      announce(copiedLabel ? `${copiedLabel} 订阅地址已复制。` : '订阅地址已复制，可以粘贴到对应客户端。');
      feedback.timer = setTimeout(() => { if (copy.dataset.copy === copiedUrl) copy.innerHTML = feedback.label; }, 1800);
    } catch { announce('复制失败，请打开规则详情中的“文件地址与 SHA-256”手动复制地址。'); }
  }
  const download = target.closest<HTMLAnchorElement>('[data-download]');
  if (download) {
    event.preventDefault();
    if (download.getAttribute('aria-busy') === 'true') return;
    const label = download.innerHTML;
    download.setAttribute('aria-busy', 'true');
    download.textContent = '正在下载…';
    try {
      const response = await fetch(download.href, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = download.dataset.download || 'rule';
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      announce('文件下载已开始。');
    } catch { announce('下载失败。请展开“文件地址与 SHA-256”，打开原始文件链接重试。'); }
    finally { download.removeAttribute('aria-busy'); download.innerHTML = label; }
  }
});

if (location.hash) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  target?.classList.add('highlighted');
}
