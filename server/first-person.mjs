export function narratorTask(ctx) {
  return `为这个主题选择一位第一人称讲述角色。先检测材料涉及的人、动物或物体，优先选择与事件直接相关、能够解释核心问题的人；没有合适的人时选择核心动物或物体进行拟人化。不要为了优先人而添加材料中不存在的人物。分析角色身份、处境和表达气质，识别角色性别与年龄段，不臆造真实年龄性别或亲身经历。gender只能为male、female、unknown；ageGroup只能为young、adult、senior、unknown，按故事发生时的年龄，不按人物去世年龄。性别以材料明确表述为优先；材料确指苏轼等身份唯一且性别为公认传记事实的知名人物时，可使用established_identity；同名不明、普通姓名、职业、性格都不能用来猜性别，不得把材料中其他人的性别或代词归给当前角色。genderBasis只能为explicit、established_identity、unknown，genderEvidence引用材料中支持判断的原文；公认人物写出其姓名及身份依据。无可靠依据必须unknown。年龄不明确填unknown，后续默认成熟声音。动物或物品无明确性别时填unknown。只返回JSON：{"name":"角色名称","kind":"person或animal或object","perspective":"以我的身份如何解释主题，100字以内","voiceDescription":"简短表达气质描述","gender":"male或female或unknown","genderBasis":"explicit或established_identity或unknown","genderEvidence":"判断依据或空字符串","ageGroup":"young或adult或senior或unknown"}。\n主题：${ctx.query}\n内容：${ctx.answer?.slice(0,8000)||''}`;
}
export function parseNarrator(raw,ctx) {
  let value;
  try { value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); } catch { throw new Error('角色分析格式不完整，请重试'); }
  if(!value||!['person','animal','object'].includes(value.kind)||!['name','perspective','voiceDescription'].every(k=>typeof value[k]==='string'&&value[k].trim()))throw new Error('角色分析格式不完整，请重试');
  let gender=['male','female'].includes(value.gender)?value.gender:'unknown';
  const basis=['explicit','established_identity'].includes(value.genderBasis)?value.genderBasis:'unknown';
  const evidence=typeof value.genderEvidence==='string'?value.genderEvidence.trim().slice(0,300):'';
  if(basis==='unknown'||!evidence)gender='unknown';
  if(ctx&&basis==='explicit'&&!([ctx.query,ctx.answer,...(ctx.references||[]).map(r=>r.text)].join('\n').includes(evidence)))gender='unknown';
  if(ctx&&basis==='established_identity'&&(![ctx.query,ctx.answer,...(ctx.references||[]).map(r=>r.text)].join('\n').includes(value.name.trim())||!evidence.includes(value.name.trim())))gender='unknown';
  const ageGroup=['young','adult','senior'].includes(value.ageGroup)?value.ageGroup:'unknown';
  return {gender,genderBasis:gender==='unknown'?'unknown':basis,genderEvidence:evidence,ageGroup,name:value.name.trim().slice(0,60),kind:value.kind,perspective:value.perspective.trim().slice(0,300),voiceDescription:value.voiceDescription.trim().slice(0,240)};
}
export function narratorDirection(narrator) {
  if(!narrator)throw new Error('请先完成第一人称角色分析');
  return `第一人称角色已确定，整期不可更换：${JSON.stringify(narrator)}。直接从角色的处境、动作或“我是${narrator.name}”进入故事，第一人称沉浸式讲述。从开场到结尾都禁止任何免责声明、身份否认、创作说明或出戏提示，包括“提前说明”“我不是北宋人”“我不是某某”“这是一段角色化想象”“假如我是”“借某某的眼睛”“作为AI”“仅供参考”。不要解释自己在扮演、模拟或想象这个角色，也不要口播资料核对、信息不足或让听众自行查证等制作说明。材料不足的细节直接省略，事实边界用角色能自然理解的语言表达，不编造事实。所有章节正文始终从这个角色的“我”出发讲述，用我的处境、行动或机制解释知识；不得退回第三人称百科介绍，也不得用泛泛的“我来介绍某某”代替角色视角。允许描述其他人或物，但叙述者始终是当前角色。人物经历必须有材料依据，动物或物体拟人化不能改变事实。结束语仍由同一角色说出。写完逐段检查第一人称视角并改写脱离角色的段落，只输出最终讲稿。`;
}
