# 精选节目第二版

本次保留原来的 15 个节目 ID 和分类，重新制作文稿与音频。列表在实际时长之后展示风格，点击仍使用 `/__local/catalog/<id>`，服务端返回对应的节目及为当前访问者签名的上下文。

| 风格 | 节目 ID | 合成路由 |
| --- | --- | --- |
| 单人讲解 | photography, gps, noise-cancel, blue-sky | TTS，刘飞 |
| 双人播客 | coffee, music, ai-hallucination, procrastination | Podcast，Sophie / 刘飞 |
| 评书 | song-city, silk-road | Seed Audio，story-v1 |
| 快板 | declutter, fridge | Seed Audio，clapper-v1 |
| 第一人称 | cat-box | Seed Audio，first-female-young-v2，猫 |
| 第一人称 | sea-wave | Seed Audio，first-male-young-v1，一滴海水 |
| 第一人称 | museum | Seed Audio，first-male-senior-v1，鹳鱼石斧图彩绘陶缸 |

动物和物体的声音属于创作配音选择，不表示生物性别。博物馆一期补充了[中国国家博物馆藏品说明](https://www.chnmuseum.cn/zp/zpml/kgfjp/202008/t20200824_247232.shtml)，以实物的造型、画面和用途串起观察方法，不把图腾解释编成确定发生的战役。

## 制作与验收

`scripts/regenerate-featured.mjs` 将生成结果保存在被 Git 忽略的 `.local-cache/featured-v2` 中。三个阶段分别为 `draft`、`audio` 和 `promote`。文稿需在音频生成前完成编辑校对；音频支持按已完成段落续接。已发布的文稿和音频以 `content/catalog` 为准，模型重新生成不保证逐字相同。

发布前检查标题、ID、风格、引擎、内置音色及第一人称视角，解码全部 MP3，并比较表演音频字幕与文稿。列表时长来自实际解码结果。大文件压缩至 64 kbps，避免节目接口响应超过平台上限。只有全部节目通过检查，才替换目录与清单。

`test/featured-catalog.test.mjs` 逐项调用目录服务，校验页面清单、服务端返回和签名上下文的一致性，以及时长和风格展示。部署后还须检查真实域名下的全部 15 个接口及浏览器播放入口。

凭据仅从本地环境文件读取，不写入节目、清单或日志，也不提交到仓库。
