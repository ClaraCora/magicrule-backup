# MagicRule 定制规则

[订阅目录](https://claracora.github.io/magicrule-backup/) · [发布文件](https://github.com/ClaraCora/magicrule-backup/tree/data/current/custom) · [同步工作流](https://github.com/ClaraCora/magicrule-backup/actions/workflows/sync.yml)

| 定制规则 | 客户端 | 用途 |
| --- | --- | --- |
| ForeignAI | Egern、Mihomo、Loon、Surge | 海外 AI 专用域名 |
| DomesticAI | Egern、Mihomo、Loon、Surge | 国内 AI 专用域名 |
| NetEaseMusic | Egern | 修正 YAML 引号，保留原规则值 |
| WebRTC | Mihomo | 匹配明确的 STUN/TURN 主机 |

data 分支发布 10 个规则文件和一个 SHA-256 校验清单。现有订阅地址仍在此路径下。

```
https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/current/custom/<客户端>/<文件名>
```

## 订阅示例

Loon 在 `[Remote Rule]` 中直接引用以下地址，放在 Google、Microsoft、GitHub、China、Global 等大合集之前，删除主配置中重复的 AI 域名快照，避免本地规则优先覆盖远程更新。Loon 的分流文件不使用 Mihomo 的 YAML `payload` 格式：

```ini
[Remote Rule]
https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/current/custom/Loon/DomesticAI.list, policy=国内直连, tag=DomesticAI, enabled=true
https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/current/custom/Loon/ForeignAI.list, policy=AI, tag=ForeignAI, enabled=true
```

Surge 在 `[Rule]` 中引用以下规则，放在 Google、Microsoft、GitHub、China、Global 等大合集及 `FINAL` 之前；将 `AI` 替换为已有的代理策略或策略组名：

```ini
[Rule]
RULE-SET,https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/current/custom/Surge/DomesticAI.list,DIRECT,update-interval=86400
RULE-SET,https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/current/custom/Surge/ForeignAI.list,AI,update-interval=86400
```

Surge 拆分文件采用 `DOMAIN` / `DOMAIN-SUFFIX` 规则行，使用 `RULE-SET` 引用。原始备份还提供上游的完整规则、`domain-set`、`rule-set` 和 `.sgmodule` 附属模块；其中 `domain-set` 使用 `DOMAIN-SET` 引用，模块按 Surge 的模块方式安装。

Mihomo 的 AI 规则使用 classical YAML，WebRTC 使用 classical text。客户端配置决定远程规则集的策略和 DNS 分流。

## 自动同步

- GitHub Actions 每天北京时间 04:17 检查四份 GlobalAI 和 Egern 的 NetEaseMusic。可在 Actions 手动运行同一工作流。
- 同步直接请求配置中的五份上游清单，只下载目标格式并校验上游声明的 SHA-256。对于上游声明支持文件头归一化的共享文件，也会校验上游声明的正文哈希。
- 请求间隔至少 250 毫秒。收到 429 时遵守 Retry-After，收到 403 时终止本轮并记录可用的 CF-Ray。
- 10 份订阅通过校验后一起更新。同步失败时继续提供上一版，失败详情见 Actions。历史版本仍在 data 分支的提交记录中。

## 本地运行

```sh
npm ci
npm test
npm run prepare:data
npm run migrate:data
npm run sync
npm run verify
npm run build
```

migrate:data 使用旧快照中已校验的五份源文件生成定制规则，并保留旧同步时间。迁移完成后再次执行不会改写发布数据。

规则来源于 MagicRule 和各上游作者，WebRTC 主机清单源自 ClaraCora/ege。保留原作者署名，第三方规则以各自许可为准。
