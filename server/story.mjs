import {APIError,parseScript} from './zhihu.mjs';
export function storyScriptTask(ctx,depth){return `你是中文知识评书编剧。围绕本期题目与原回答，依据 reference_data 写完整的单人评书。事实准确，悬念服务内容，不编造史实或亲身经历。
题目：${ctx.query||''}
原回答：${String(ctx.answer||'').slice(0,14000)}
首先为这一次具体主题原创一首四句七言定场诗。每句七个汉字，第二、四句尽量押韵，意象和立意必须对应本期内容；不得套用通用开场诗，不冒充古人原作，不为押韵编造事实。诗句只写入 openingPoem 数组，不在 segments 中重复。定场诗是全期最先说出的内容，诗前不问候、不报幕、不加标题。
正文承接诗意，以“话说”等自然转入主题。单人评书，speaker始终为A；${depth==='deep'?'约800至1000':'约350至500'}字，每段不超过300字，分为“问题引入”“问题分析”“结论总结”三个连续章节。第一段在诗后简短问候一次即可；用讲故事、设问、解释、对照推进，最后回应题目并自然收束，不留未解的预告。
可以适当加入（轻拍醒木）（拍醒木，停半拍）（压低声音）（稍作停顿）等中文括号表演动作，每期醒木约一至两次，放在诗后转入正文、关键转折或收束处；不必每段拍，不打断句子，不滥用音效。括号内容只供音频表演，不念出动作文字。声音仍是一位评书演员，没有竹板、第二人或观众掌声。
只返回合法JSON：{"openingPoem":["七个汉字的诗句","七个汉字的诗句","七个汉字的诗句","七个汉字的诗句"],"segments":[{"chapterTitle":"问题引入","speaker":"A","text":"（轻拍醒木）话说……","sourceIds":[]}]}
openingPoem必须恰好四句。sourceIds只用实际依据的现有材料编号，正文不念引用编号。不要Markdown、身份说明、免责声明或制作说明。输出前检查诗与题目对应、四句各七字、正文没有重复诗句，三个章节完整。`}

export function addStoryOpening(raw,result){
 let data;try{data=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{}
 const poem=data?.openingPoem;
 if(!Array.isArray(poem)||poem.length!==4||poem.some(line=>typeof line!=='string'||!/^[\p{Script=Han}]{7}$/u.test(line.replace(/[，。！？、；：\s]/g,''))))throw new APIError('评书定场诗格式不完整，请重新生成',502,'INVALID_STORY_POEM');
 const lines=poem.map(line=>line.replace(/[，。！？、；：\s]/g,''));
 result.openingPoem=lines;
 result.segments[0].text=lines.map((line,i)=>line+(i%2?'。':'，')).join('\n')+'\n'+result.segments[0].text;
 return result;
}

export async function generateStoryScript(generate,refs,signal){
 for(let retry=0;retry<=3;retry++){
  signal?.throwIfAborted();
  const raw=await generate(retry?'上一版格式校验未通过。请重新生成完整JSON，openingPoem必须为四句，每句恰好七个汉字，segments必须包含非空正文。':'');
  try{const result=parseScript(raw,refs,'story');if(result.style!=='story'||!result.segments.length)throw new APIError('讲稿格式错误',502,'INVALID_SCRIPT');return addStoryOpening(raw,result)}
  catch(error){if(!['INVALID_STORY_POEM','INVALID_SCRIPT'].includes(error.code))throw error;if(retry===3)throw new APIError('出现未知问题，请重试。',502,'STORY_GENERATION_FAILED')}
 }
}
