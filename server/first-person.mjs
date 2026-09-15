export function narratorTask(ctx) {
  return `为这个主题选择一位第一人称讲述角色。先检测材料涉及的人、动物或物体，优先选择与事件直接相关、能够解释核心问题的人；没有合适的人时选择核心动物或物体进行拟人化。不要为了优先人而添加材料中不存在的人物。分析角色身份、处境和表达气质，设计原创音色，不模仿真人声音、不臆造真实年龄性别或亲身经历。只返回JSON：{"name":"角色名称","kind":"person或animal或object","perspective":"以我的身份如何解释主题，100字以内","voiceDescription":"可直接用于声音合成的音色描述，描述音高、音质、语速、情绪和口吻，30至180字"}。\n主题：${ctx.query}\n内容：${ctx.answer?.slice(0,8000)||''}`;
}
export function parseNarrator(raw) {
  let value;
  try { value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); } catch { throw new Error('角色分析格式不完整，请重试'); }
  if(!value||!['person','animal','object'].includes(value.kind)||!['name','perspective','voiceDescription'].every(k=>typeof value[k]==='string'&&value[k].trim()))throw new Error('角色分析格式不完整，请重试');
  return {name:value.name.trim().slice(0,60),kind:value.kind,perspective:value.perspective.trim().slice(0,300),voiceDescription:value.voiceDescription.trim().slice(0,240)};
}
export function narratorDirection(narrator) {
  if(!narrator)throw new Error('请先完成第一人称角色分析');
  return `第一人称角色已确定，整期不可更换：${JSON.stringify(narrator)}。直接从角色的处境、动作或“我是${narrator.name}”进入故事，第一人称沉浸式讲述。从开场到结尾都禁止任何免责声明、身份否认、创作说明或出戏提示，包括“提前说明”“我不是北宋人”“我不是某某”“这是一段角色化想象”“假如我是”“借某某的眼睛”“作为AI”“仅供参考”。不要解释自己在扮演、模拟或想象这个角色，也不要口播资料核对、信息不足或让听众自行查证等制作说明。材料不足的细节直接省略，事实边界用角色能自然理解的语言表达，不编造事实。所有章节正文始终从这个角色的“我”出发讲述，用我的处境、行动或机制解释知识；不得退回第三人称百科介绍，也不得用泛泛的“我来介绍某某”代替角色视角。允许描述其他人或物，但叙述者始终是当前角色。人物经历必须有材料依据，动物或物体拟人化不能改变事实。结束语仍由同一角色说出。写完逐段检查第一人称视角并改写脱离角色的段落，只输出最终讲稿。`;
}
