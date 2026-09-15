// Hold-to-talk buffers PCM locally; authenticated HTTPS submits only on release.
// The socket-shaped interface also supports the existing recording dialog.
class HttpAsrConnection {
 constructor(){this.readyState=1;this.bufferedAmount=0;this.chunks=[];this.size=0;this.controller=new AbortController();setTimeout(()=>this.emit({type:'ready'}),0)}
 emit(data){if(this.readyState===1)this.onmessage?.({data:JSON.stringify(data)})}
 send(data){if(this.readyState!==1||this.submitted)return;if(typeof data==='string'){if(JSON.parse(data).type==='stop'){this.submitted=true;this.submit()}return}const bytes=new Uint8Array(data).slice();this.size+=bytes.length;if(this.size>1920000){this.emit({type:'error',error:'录音最长 60 秒，请缩短问题'});this.close();return}this.chunks.push(bytes)}
 async submit(){const timeout=setTimeout(()=>{this.emit({type:'error',error:'语音识别超时，请重试'});this.close()},30000);try{const body=new Blob(this.chunks,{type:'application/octet-stream'});this.chunks=[];const response=await fetch('/api/voice/transcribe',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream'},body,signal:this.controller.signal});const text=await response.text();let result;try{result=JSON.parse(text)}catch{throw Error(response.status===401||response.status===403?'请先登录后使用听海':'服务返回异常，请稍后重试')}if(!response.ok)throw Error(result.error||'语音识别暂不可用');this.emit({type:'transcript',text:result.text,final:true});this.emit({type:'done'});this.close()}catch(e){if(this.readyState===1){this.emit({type:'error',error:e.name==='AbortError'?'语音识别已取消':e.message||'录音提交失败，请重试'});this.close()}}finally{clearTimeout(timeout)}}
 close(){if(this.readyState===3)return;this.readyState=3;this.chunks=[];this.controller.abort();this.onclose?.()}
}
