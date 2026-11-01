# MagicRule Backup

[检索网站](https://claracora.github.io/magicrule-backup/) · [同步工作流](https://github.com/ClaraCora/magicrule-backup/actions/workflows/sync.yml) · [备份文件](https://github.com/ClaraCora/magicrule-backup/tree/data/current/rules) · [数据历史](https://github.com/ClaraCora/magicrule-backup/commits/data/)

每日自动备份 MagicRule 为 **Egern、Mihomo、Loon** 公开提供的规则文件，并提供中文检索、客户端与类型筛选、详情、文件下载及更新时间展示。网站及下载使用本仓库中的备份，不在访客浏览时请求原站。

## 自动同步

- 北京时间每天 **04:17**（UTC `17 20 * * *`）通过 GitHub Actions 运行，GitHub 调度可能延迟。
- `main` 分支保存代码与工作流，`data` 分支保存完整备份。Pages 发布源为 **GitHub Actions**。
- 读取三个客户端的索引及每条规则的 manifest，跟随 `magicrule.pages.dev` 和 `rule-26r.pages.dev` 上的文件地址。
- 四路并发，单请求 30 秒超时，最多尝试三次。文件按 SHA-256 增量下载；已下载的字节不会重写。
- 先在临时目录完成整批校验，全部成功后再替换 `current/`。超时、404、HTML 错误页、无效清单或校验失败均中止发布并保留原备份。
- 下架规则保留最后文件，目录标记为下架。Git 提交保留历史版本；每次成功检查都有状态提交，内容未变的文件不产生新 Git blob。
- 网站展示最近 90 次成功同步。超过 36 小时未成功时，访客页面提示逾期；失败原因及通知使用 GitHub Actions 日志和账号通知设置。

### 源站共享文件的校验

源站部分清单的 `bytes_sha256` 与共享文件头中的生成时间等注释存在差异。校验优先使用完整字节 SHA-256；只有源站明确声明 `standard_header_normalized`、`normalized_header_lines = 4`，且文件前四行为标准 `NAME / AUTHOR / REPO / UPDATED` 注释时，才允许以其声明的 `semantic_sha256` 验证其余正文。正文哈希不符仍会失败；二进制文件必须逐字节匹配。

所有文件都保留实际下载字节。目录同时记录实际 `sha256`、清单的 `expectedSha256` 及 `verification` 方法，不会重写文件来迎合源站校验值。无上游哈希的文件记录本地哈希，标记为 `recorded`，不宣称已完成上游哈希比对。

## 页面与数据接口

- 首页：中英文名称、说明、来源搜索，客户端、规则类型和下架状态筛选；同 ID 的规则合并展示，筛选需在同一客户端记录上同时满足。
- `/rules/<id>/`：各客户端的条数、日期、全部格式、来源、实际 SHA-256、复制订阅地址与下载。
- `/updates/`：成功同步记录与变动列表。`/about/`：使用与恢复说明。
- `/catalog.json`：完整规范化目录，`schemaVersion: 1`，包含规则、客户端变体及各格式的哈希和地址。
- `/search-index.json`：供浏览器使用的精简检索目录。`/status.json`：最近成功时间、条数、文件数及总体积。
- 稳定下载地址：`https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/current/rules/<client>/<rule-id>/<artifact-key>.<ext>`。

以上网页和 JSON 地址都位于 `/magicrule-backup/` 路径下。检索不包含域名/IP 内容反查，也不提供在线格式转换。

时间统一按 **Asia/Shanghai** 显示：

| 字段 | 定义 |
| --- | --- |
| 源站规则更新时间 | 索引的 `rule_updated_at`，缺失时取 manifest 的同名字段；仍缺失则显示未提供，不使用生成时间冒充 |
| 备份文件变更时间 | 本仓库首次采集、文件字节或文件列表变化的时间，包括注释变化 |
| 最近同步成功时间 | 完整备份校验成功的时间，内容未变也会更新 |

## 本地开发

需要 **Node.js 24+**、npm 与 Git。仓库克隆后执行：

```sh
npm ci
npm run prepare:data
# data 分支有已发布快照时可直接启动；首次初始化或要更新快照时执行：
npm run sync
npm run dev
```

打开终端输出的 `/magicrule-backup/` 地址。规则数据在忽略跟踪的 Git worktree `.cache/backup` 中；可用环境变量 `BACKUP_DIR` 指定另一个已准备好的数据目录。`npm run sync` 只更新本地数据，不自动提交或推送。

```sh
npm run check
npm test
npm run build
npm run preview
```

测试使用本地 HTTP 源和临时目录，不访问原站；覆盖二进制字节、增量复用、三类日期、下架保留、哈希异常、HTML 错误页、404、非预期来源、失败回滚、重试及检索筛选。

## 手动同步和恢复

在 **Actions → Sync and publish → Run workflow** 中执行；`sync` 默认开启。关闭 `sync` 则只用现有 data 分支重新构建网站，适合代码更新或恢复后重新发布。

单个文件恢复：到 data 分支提交历史中选中日期，打开目标文件，复制对应固定提交 SHA 的 Raw 地址。该地址不会随后续同步变化。

维护者恢复整个备份（保留历史，不强制推送）：

```sh
npm run prepare:data
git -C .cache/backup restore --source <known-good-data-commit> -- current
git -C .cache/backup add current
git -C .cache/backup commit -m "restore: known good backup"
git -C .cache/backup push origin data
```

随后手动运行工作流并**关闭 sync**，发布恢复后的快照。若需要暂停上游更新，在 Actions 中暂时禁用同步工作流；再次启用后会继续跟随原站。数据提交只发生在网站构建成功后，同一个工作流直接部署 Pages，不依赖机器人提交触发下一条工作流。

## 配置与来源

`sync.config.json` 定义客户端、原站、允许的文件来源、仓库与并发。添加新的文件来源域名之前应核对其属于原站公开清单。Pages 域名与仓库子路径在 `astro.config.mjs` 中设置。修改客户端后重新同步并构建。

规则来源于 [MagicRule](https://magicrule.pages.dev/) 及其清单中的上游作者。原始目录、文件清单保存于 data 分支 `current/raw/`；所有规则及附属文件保留原始字节、署名和许可说明。第三方规则权利与许可归原作者，本项目不对这些规则重新授权。

本站是独立备份及检索站，不代表原站。原站图标、后台、第三方服务及在线转换功能不在备份范围内。
