export interface Artifact {
  key: string;
  fileName: string;
  label: string;
  extension: string;
  binary: boolean;
  empty: boolean;
  recommended: boolean;
  path: string;
  url: string;
  sourceUrl: string;
  sha256: string;
  expectedSha256: string | null;
  verification: 'bytes' | 'normalized-header' | 'recorded';
  bytes: number;
  changedAt: string;
}

export interface Variant {
  client: string;
  name: string;
  chineseName: string;
  description: string;
  types: string[];
  typeCounts: Record<string, number>;
  totalLineCount: number | null;
  sourceUpdatedAt: string | null;
  generatedAt: string | null;
  fileChangedAt: string | null;
  providers: string[];
  sourceManifestUrl: string;
  archived: boolean;
  artifacts: Artifact[];
}

export interface Rule {
  id: string;
  name: string;
  chineseName: string;
  variants: Variant[];
}

export interface Catalog {
  schemaVersion: 1;
  clients: string[];
  rules: Rule[];
}

export interface SyncStatus {
  schemaVersion: 1;
  source: string;
  lastSuccessfulSyncAt: string;
  activeRuleCount: number;
  clientRuleCount: number;
  artifactCount: number;
  totalBytes: number;
  downloadedFiles: number;
  reusedFiles: number;
  clients: { name: string; count: number; generatedAt: string | null }[];
}

export interface Change {
  id: string;
  name: string;
  client: string;
  kind: 'added' | 'modified' | 'removed';
}

export interface SyncRun {
  syncedAt: string;
  added: number;
  modified: number;
  removed: number;
  changes: Change[];
}
