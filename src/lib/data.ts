import path from 'node:path';
import { clients, directSourceGroups } from '../../scripts/config-rules.ts';
import { verifyCustom } from '../../scripts/verify.ts';
import type { Catalog, Rule, SyncStatus } from './types';

const repository = 'https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/';
const webRTCSource = 'https://raw.githubusercontent.com/ClaraCora/ege/main/mihomo/WebRTC.list';
const snapshot = path.resolve(process.env.BACKUP_DIR || '.cache/backup', 'current');
const definitions: Record<string, { id: string; chineseName: string; description: string }> = {
  ForeignAI: { id: 'foreign-ai', chineseName: '海外 AI', description: '海外 AI 服务专用域名，可单独指定代理策略。' },
  DomesticAI: { id: 'domestic-ai', chineseName: '国内 AI', description: '国内 AI 服务专用域名，可单独指定直连或 DNS 策略。' },
  NetEaseMusic: { id: 'netease-music', chineseName: '网易云音乐', description: '适用于 Egern 的网易云音乐域名、IP 和 User-Agent 规则。' },
  WebRTC: { id: 'webrtc', chineseName: 'WebRTC 主机', description: '适用于 Mihomo 的 STUN/TURN 主机清单。' },
};

async function load() {
  const manifest = await verifyCustom(snapshot);
  const rules = new Map<string, Rule>();
  for (const item of manifest.files) {
    const [client, fileName] = item.file.split('/');
    const [name, extension] = fileName.split('.');
    const definition = definitions[name];
    let rule = rules.get(name);
    if (!rule) {
      rule = { id: definition.id, name, chineseName: definition.chineseName, variants: [] };
      rules.set(name, rule);
    }
    const source = manifest.schemaVersion === 1 ? manifest.sources[client + '/' + (name.endsWith('AI') ? 'GlobalAI' : name)] : undefined;
    const directSources = manifest.schemaVersion === 2 && name !== 'WebRTC'
      ? directSourceGroups[name.endsWith('AI') ? 'ai' : 'music'].map(id => manifest.sources[id])
      : [];
    const providers = directSources.length ? directSources.map(input => input.repo) : [source?.url ?? webRTCSource];
    const sourceManifestUrl = directSources.length ? repository + 'current/custom/manifest.json' : source?.manifestUrl ?? webRTCSource;
    const filePath = 'current/custom/' + item.file;
    const key = client === 'Mihomo' && extension === 'yaml' ? 'classical' : 'rules';
    rule.variants.push({
      client, name, chineseName: definition.chineseName, description: definition.description,
      types: Object.keys(item.typeCounts), typeCounts: item.typeCounts,
      totalLineCount: Object.values(item.typeCounts).reduce((total, count) => total + count, 0),
      sourceUpdatedAt: source?.updatedAt ?? null, generatedAt: null, fileChangedAt: item.changedAt,
      providers, sourceManifestUrl,
      archived: false, artifacts: [{
        key, fileName, label: name, extension, binary: false, empty: false, recommended: false,
        path: filePath, url: repository + filePath, sourceUrl: directSources[0]?.url ?? source?.url ?? webRTCSource,
        sha256: item.sha256, expectedSha256: item.sha256, verification: 'bytes', bytes: item.bytes, changedAt: item.changedAt,
      }],
    });
  }
  const catalog: Catalog = { schemaVersion: 1, clients: [...clients], rules: [...rules.values()] };
  const status: SyncStatus = {
    schemaVersion: 1, source: manifest.schemaVersion === 2 ? repository + 'current/custom/manifest.json' : 'https://magicrule.pages.dev',
    lastSuccessfulSyncAt: manifest.syncedAt,
    activeRuleCount: catalog.rules.length, clientRuleCount: manifest.files.length, artifactCount: manifest.files.length,
    totalBytes: manifest.files.reduce((total, file) => total + file.bytes, 0),
    downloadedFiles: 0, reusedFiles: 0,
    clients: clients.map(name => ({
      name, count: manifest.files.filter(file => file.file.startsWith(name + '/')).length, generatedAt: null,
    })),
  };
  return { catalog, status };
}

let data: ReturnType<typeof load> | undefined;
const loadData = () => data ??= load();
export const loadCatalog = async () => (await loadData()).catalog;
export const loadStatus = async () => (await loadData()).status;
