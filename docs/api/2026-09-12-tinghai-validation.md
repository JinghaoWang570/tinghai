# 听海技术验证与选型记录

整理日期：2026-09-12；下列实测来自 2026-09-08、09-11 对话中的工具结果，本次为整理，不是再次压测。接口文档以 09-11 官网读取为依据。原始响应未作为仓库工件留存，仅保留参数、结果摘要和公开来源。

## 1. 已验证的内容能力

| 能力 | 09-11 请求参数 | 结果 | 单次客户端耗时 |
| --- | --- | --- | --- |
| 知乎搜索 | Query=为什么天空是蓝色的 瑞利散射；Count=3 | Code=0；3 条，有作者和链接，ContentText 官方定义为摘要 | 0.676 秒 |
| 知识库检索 | Query=机会成本 沉没成本 决策；RecallScopes=[public]；Limit=3 | Code=0；3 条文档结果，正文片段 | 1.413 秒 |
| 问题回答 | QuestionUrl=https://www.zhihu.com/question/2079139965502543238；Limit=2 | Code=0；2 条摘要；IsEnd=true | 0.966 秒 |

这是本机单次端到端请求，包含 CLI/HTTP 开销，不是服务 SLA、P50/P95 或语音延迟。09-08 公共知识库还曾召回《魔鬼数学》幸存者偏差片段；两条重复，不是整章完整性证明。

09-11 额度查询快照：知识库 500/日、余 499；知乎搜索 5000/日、余 4999；小工具 10/日、余 10。所有数字仅代表当次账号状态，不表示今日余额或永久免费承诺。

## 2. 正文和板块边界

- [知乎搜索](https://developer.zhihu.com/docs?key=zhihu_search)：ContentText 是摘要，文本长不代表完整。
- [知识库检索](https://developer.zhihu.com/docs?key=knowledge_search)：Content 是同一文档命中的有序正文片段；OriginUrl 可缺失；public 是召回范围，不代表内容获得开放版权。
- [问题回答](https://developer.zhihu.com/docs?key=question_answers)：Summary 是摘要/截取文本，不是全文。
- [我的创作全文](https://developer.zhihu.com/docs?key=user_content_detail)：文档支持当前 Access Secret 账号自己的已发布正文 Body，可含 HTML；不接受 OAuth 身份切换。本项目未实测全文接口。
- 当前公开目录没有找到“知乎知识栏目目录/章节全文”“盐选故事全文”或 TTS 专用接口。赛事专用材料是否另行提供，待主办方确认。
- [PPT 生成](https://developer.zhihu.com/docs?key=ppt_generation)支持回答/文章链接异步生成 6–21 页；仅查文档，未创建任务。听海不以 PPT/HTML 生成作为核心功能。

本地 CLI 当时为 0.5.0，能力清单少于官网最新目录；问题回答使用已公开文档的 HTTP 接口验证。不能将 CLI 缺少命令等同于平台没有能力。

## 3. 适合的候选主题

| 主题 | 已见材料 | 改编方向 | 待处理 |
| --- | --- | --- | --- |
| 蓝天与晚霞 | [天空属于宇宙哪部分](https://www.zhihu.com/question/2079139965502543238/answer/2080751468802588816) | 双人解释、听众追问 | 核验科学解释；文本中的图片不能假定已获得 |
| 机会成本/沉没成本 | [生产成本案例](https://www.zhihu.com/answer/95697015137) | 面包房经营抉择 | 原文 100−76.8 写为 23.3，实际 23.2；经济利润应相应核算为 10.2 |
| 幸存者偏差 | 09-08 公共库召回《魔鬼数学》片段 | 飞机装甲情境 | 重复召回、书籍授权、历史叙事校验 |

上述是候选素材，不是已经授权的节目库。即使有来源，内容也可能存在算术错误、缺图和解释偏差。

## 4. 素材改编与演示

[赛事手册本地整理](../competition/developer-handbook.md)记录了盐选小说/IP 的比赛期间使用和赛后商用限制，但该记录不能扩展为所有检索内容的改编许可。尚未拿到逐项适用的授权结论。

公开演示前确认：具体素材清单；允许摘要/改写/音频化的范围；是否可送第三方模型；公开 Demo 与演示视频的展示范围；赛后可保留多久；署名与来源要求。未向主办方发送消息。优先选团队原创或明确授权材料；技术可读与用途授权分开记录。

## 5. TTS / ASR / LLM 选型

目前没有真实音频或 ASR 测试结果，模型均未选定。09-11 在当前环境及项目 .env 的相关名称中未发现 MiniMax/百炼凭证；这不代表团队其他环境没有账号。

[百炼 MiniMax 官方文档](https://help.aliyun.com/zh/model-studio/minimax-synchronous-speech-synthesis-api)（09-11 核对）：Speech 2.8 Turbo 为 2 元/万字符，HD 为 3.5 元/万字符。2000 计费字符约 0.40/0.70 元；不含 LLM、ASR、存储、流量和重生成；渠道价格不代表 MiniMax 所有渠道。

首轮比较两家可接入服务：MiniMax 为候选之一，另一家按凭证可用性选定，不因调研而接入多家。用同一 200 字知识稿、200 字快板稿、6 轮双人对话，每项少量重复测试。记录读音、可懂度、节奏、角色区别、首个可播放音频时间、总耗时、音频时长、费用和失败情况。

| 实验 | 负责人 | 状态 | 决策门槛 |
| --- | --- | --- | --- |
| 两套风格讲稿与事实核验 | A | 待做 | 信息正确、风格区别清楚 |
| 快板节奏、双人音色、分段拼接 | A | 待做 | 不把押韵朗读夸成真实快板；必要时团队调整风格 |
| TTS 首音频/总时间、费用 | A | 待做 | 记录真实数据后确定等待提示和节目长度 |
| 安静/噪声环境、专有名词 ASR | B | 待做 | 转写可确认修改；失败可打字 |
| “刚才那个例子”上下文问答 | B | 待做 | 回答结合当前段落与来源 |
| HTTPS 录音、手机播放及恢复 | B | 待做 | 电脑、手机各跑通 |

## 6. 建议技术边界与共享契约（尚未实现）

不自建向量库；优先使用知乎现有检索。直答 Agent 可选，不假定它能替代所有讲稿生成或流式 TTS。前后端栈由两人熟悉程度决定；本地已有最小 Python API 客户端，不代表完整 Web 服务。

| 对象 | 最小字段 |
| --- | --- |
| Source | id、title、url（可空）、text、contentKind（摘要/片段/授权全文）、checkedAt、usageStatus |
| Episode | id、topic、style、status、sourceIds、chapters、error |
| Chapter | id、order、script、sourceIds、audioStatus、audioUrl、duration（未知可空） |
| ScriptTurn | speakerId、text、sourceIds；双人播客用固定 speakerId 对应音色 |
| Question | episodeId、chapterId、playbackSeconds、confirmedTranscript、recentTurns |
| Answer | text、sourceIds、audioStatus、audioUrl、resumePosition |

A 提供创建节目/查询进度/共用 TTS 的接口；B 提供录音转写/问答流程并对接播放器。H0–H4 定下具体路径与 JSON 示例。分段合成按段缓存与幂等；密钥仅后端；问题结束前保存节目位置；取消旧请求避免声音串台。录音默认仅用于当次识别，不做永久保存。
