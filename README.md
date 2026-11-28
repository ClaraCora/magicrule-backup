# MagicRule 定制规则

[订阅目录](https://claracora.github.io/magicrule-backup/) · [发布文件](https://github.com/ClaraCora/magicrule-backup/tree/data/current/custom) · [同步工作流](https://github.com/ClaraCora/magicrule-backup/actions/workflows/sync.yml)

| 定制规则 | 客户端 | 用途 |
| --- | --- | --- |
| ForeignAI | Egern、Mihomo、Loon、Surge | 海外 AI 专用域名 |
| DomesticAI | Egern、Mihomo、Loon、Surge | 国内 AI 专用域名 |
| NetEaseMusic | Egern | 网易云音乐域名、IP 和 User-Agent 规则 |
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

Surge 拆分文件采用 `DOMAIN` / `DOMAIN-SUFFIX` 规则行，使用 `RULE-SET` 引用。

Mihomo 的 AI 规则使用 classical YAML，WebRTC 使用 classical text。客户端配置决定远程规则集的策略和 DNS 分流。

## 自动同步

- GitHub Actions 每天北京时间 04:17 从作者的 GitHub 仓库和官方 Git 镜像获取六份输入。可在 Actions 手动运行同一工作流。
- AI 使用 [VPSDance](https://github.com/VPSDance/ai-proxy-rules)、[v2fly](https://github.com/v2fly/domain-list-community) 和 [Sukka 的官方 Git 镜像](https://github.com/SukkaLab/ruleset.skk.moe)，按本地策略生成四种客户端格式。v2fly 从仓库归档读取 AI 分类及其引用文件。
- 网易云音乐使用 [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR)、[Mazetsz](https://github.com/Mazetsz/ACL4SSR) 和 [Sukka](https://github.com/SukkaW/Surge) 的作者源文件，以 YAML 字符串写入 User-Agent。现有 AI 和网易云音乐订阅中需要保留的差异记在 [本地规则策略](config-rules/policy.json) 的 `compatibility` 中。
- 请求间隔至少 250 毫秒。收到 429 时遵守 Retry-After，收到 403 时结束本轮并记录可用的诊断信息。同步会解析上游规则，并在清单中记录实际下载地址和内容的 SHA-256。
- 10 份订阅通过校验后一起更新。同步失败时继续提供上一版，失败详情见 Actions。历史版本仍在 data 分支的提交记录中。

## 本地运行

```sh
npm ci
npm test
npm run prepare:data
npm run sync
npm run verify
npm run build
```

定制规则始于 MagicRule，WebRTC 主机清单源自 [ClaraCora/ege](https://github.com/ClaraCora/ege)。发布文件保留作者署名，作者许可与同步输入见发布清单。
