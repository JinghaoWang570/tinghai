# 听海材料索引与决策演进

整理日期：2026-09-12。本文件聚合当前对话、仓库已有材料和已经访问的公开来源；不复制会议私人闲聊、第三方书籍全文或短期签名下载链接。

## 当前结论与历史方向

| 阶段 | 内容 | 当前地位 |
| --- | --- | --- |
| 09-08 讨论纪要 | Coffee chat、短读物、小说互动、知识可视化、第一人称/评书/快板 | 历史探索，非当前范围 |
| 09-08 GitHub 技术调研 | 观点实验室、学习地图、互动叙事及多个开源框架 | 历史候选；不能继续把“优先观点实验室”当作当前决定 |
| 09-08/09-11 API验证 | 搜索与知识库片段可获取；全文/授权/TTS 有边界 | 当前技术证据，见验证记录 |
| 后续团队明确 | 多风格知识音频、语音提问、独立界面、命名听海 | 当前产品方向 |
| 两人规划 | A内容音频、B界面问答、48小时执行 | 建议方案，成员与选型待确认 |

09-08 原始会议文件及开源研究快照在本地存在，部分尚未提交；本次不直接上传原始录音纪要、个人数据表、压缩包或整段第三方材料。当前可共享结论已在 PRD 和本文消化。

## 仓库基线（本次整理前）

- GitHub：私有仓库 [JinghaoWang570/z_5yg](https://github.com/JinghaoWang570/z_5yg)。09-12 查询时 main 为 `ba59007`，尚无开放 PR。
- 已提交：目录骨架、协作约定、[赛事手册整理](../competition/developer-handbook.md)、[赛事开放能力整理](../api/zhihu-hackathon.md)。后者为 09-07 快照，其能力和额度描述需以较新验证覆盖。
- 本地未提交：最小 Python API 客户端、测试目录、API/研究索引更新、GitHub 调研及队伍研究材料。存在文件不等于已测试或已部署；本次不修改、不提交这些既有改动。
- 当前尚无已验证可运行的听海前端、音频生成、ASR 或实时问答服务。

## 官方与技术来源

| 来源 | 已获取信息/日期 | 限制 |
| --- | --- | --- |
| [官方赛事手册](https://my.feishu.cn/docx/Mc80dR5XvoPaYDxcTasc04POnjd) | 仓库09-07整理：赛道、48小时、提交与素材规则 | 时间和具体授权须核对最新通知 |
| [知乎文档中心](https://developer.zhihu.com/docs) | 09-11读取公开目录 | 通用平台文档不代表全部赛事专用资源 |
| [知识库检索](https://developer.zhihu.com/docs?key=knowledge_search) | 有序正文片段、范围与来源字段 | 非整篇全文；用途授权独立判断 |
| [知乎搜索](https://developer.zhihu.com/docs?key=zhihu_search) | 摘要、作者、来源 | 09-11已实测 |
| [问题回答](https://developer.zhihu.com/docs?key=question_answers) | 同一问题多回答摘要 | 09-11已实测 |
| [本人全文](https://developer.zhihu.com/docs?key=user_content_detail) | 当前账号已发布内容 Body | 仅文档核对，未实测 |
| [PPT生成](https://developer.zhihu.com/docs?key=ppt_generation) | 回答/文章转PPT | 非听海核心范围，未生成 |
| [MiniMax百炼接口](https://help.aliyun.com/zh/model-studio/minimax-synchronous-speech-synthesis-api) | 09-11核对价格和流式能力 | 未测音质/延迟；价格需选型时复核 |

## 竞品观察的可信范围

[今天学点啥/秘塔书架](https://metaso.cn/bookshelf)：09-08读到书架、学习进度及章节入口；课程链接包含快板/暴躁风格、语言、音色、语速、字幕参数。进入课程后浏览器反复超时，未完成播放和提问测试。会议里提到的体验属于团队观察，不应写成 Agent 已亲测结果。

因此只可据此提出“风格切换已有竞品、需要体验差异”的判断，不能宣称对方没有上下文问答、不能打断或音质不佳。

## 仍可参考的开源项目

- [Pipecat](https://github.com/pipecat-ai/pipecat)：语音管线参考；是否采用取决于两人熟悉度和接入成本，未安装实测。
- [Sepia](https://github.com/Nanako0129/sepia)：叙事审校思路参考，不能替代事实校验。
- [CopilotKit](https://github.com/CopilotKit/CopilotKit)：交互状态参考，简单首版可直接实现。
- json-render、OpenWiki、LightRAG、OpenStory 属于此前探索；当前不因已有调研就自动纳入依赖。

## 后续材料归档规则

模型实验记录输入摘要、模型版本、时间、费用和听感；授权记录保留来源、日期和适用范围；PRD变更记录原因和取舍。只提交必要摘录与链接，敏感凭证、录音与可识别个人材料按实际需要另行处理。
