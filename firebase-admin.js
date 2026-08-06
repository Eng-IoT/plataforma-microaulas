import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {getAuth,setPersistence,browserLocalPersistence,signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {getFirestore,collection,onSnapshot,doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import {getStorage,ref,uploadBytes,getDownloadURL,deleteObject} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js';

const firebaseConfig={apiKey:'AIzaSyBGErse8k_rBppkxMPMskSPHo3a0frz6zA',authDomain:'microaulas-senai-hub.firebaseapp.com',projectId:'microaulas-senai-hub',storageBucket:'microaulas-senai-hub.firebasestorage.app',messagingSenderId:'173195996159',appId:'1:173195996159:web:20a44477e849420bb255ca'};
const ADMIN_UID='xLq1kexQmEbYZXenbTKvvX6XeR83';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
const $=s=>document.querySelector(s);
let user=null,cloudDocs=[],editing=null,queue=[];

setPersistence(auth,browserLocalPersistence).catch(()=>{});

function notify(message){window.microaulasAPI?.toast(message)}
function cleanLines(value){return value.split('\n').map(x=>x.trim()).filter(Boolean)}
function safeName(name){return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').toLowerCase()}
function mergedAdminLessons(){
  const map=new Map(window.microaulasAPI.getBaseLessons().map(l=>[String(l.id),{...l,source:'local'}]));
  cloudDocs.forEach(l=>{if(l.deleted)map.delete(String(l.id));else map.set(String(l.id),{...l,source:'firebase'})});
  return [...map.values()].sort((a,b)=>(a.order||a.id)-(b.order||b.id));
}
function syncPublic(){window.microaulasAPI.setCloudLessons(cloudDocs)}

onSnapshot(collection(db,'microaulas'),snap=>{
  cloudDocs=snap.docs.map(d=>({...d.data(),docId:d.id}));
  syncPublic();
  if(user?.uid===ADMIN_UID)renderAdminList();
},error=>{
  console.warn('Firestore indisponível:',error.code);
  if(error.code==='permission-denied')notify('Publique as regras do Firestore para ativar o conteúdo online.');
});

onAuthStateChanged(auth,current=>{
  user=current?.uid===ADMIN_UID?current:null;
  $('#adminBtn').classList.toggle('is-authenticated',!!user);
  $('#adminBtn').textContent=user?'⚙ Gerenciar':'⚙ Administrar';
  if(current&&!user){signOut(auth);$('#loginError').textContent='Este usuário não possui permissão administrativa.'}
});

$('#adminBtn').onclick=()=>user?openManager():$('#loginDialog').showModal();
$('#loginClose').onclick=()=>$('#loginDialog').close();
$('#adminClose').onclick=()=>$('#adminDialog').close();
$('#logoutBtn').onclick=async()=>{await signOut(auth);$('#adminDialog').close();notify('Sessão administrativa encerrada.')};
$('#loginForm').onsubmit=async event=>{
  event.preventDefault();const button=$('#loginSubmit');button.disabled=true;$('#loginError').textContent='';
  try{const credential=await signInWithEmailAndPassword(auth,$('#adminEmail').value.trim(),$('#adminPassword').value);if(credential.user.uid!==ADMIN_UID)throw new Error('unauthorized');$('#adminPassword').value='';$('#loginDialog').close();openManager()}
  catch(error){$('#loginError').textContent=error.message==='unauthorized'?'Usuário sem autorização administrativa.':'Não foi possível entrar. Confira o e-mail, a senha e o método E-mail/senha no Firebase.'}
  finally{button.disabled=false}
};

function openManager(){if(!user)return;$('#adminIdentity').textContent=`${user.email} • administrador`;renderAdminList();resetEditor();$('#adminDialog').showModal()}
function renderAdminList(){
  const list=mergedAdminLessons();$('#adminLessonCount').textContent=`${list.length} aulas`;
  $('#adminLessonList').innerHTML=list.map(l=>`<button class="admin-lesson-item ${editing?.docId===l.docId?'active':''}" type="button" data-id="${l.id}"><span>${String(l.id).padStart(2,'0')}</span><div><strong>${escapeHtml(l.title)}</strong><small>${l.published===false?'Rascunho':l.source==='firebase'?'Online':'Base local'} • ${(l.slides||[]).length} telas</small></div><b>›</b></button>`).join('');
  document.querySelectorAll('.admin-lesson-item').forEach(b=>b.onclick=()=>editLesson(Number(b.dataset.id)));
}
function escapeHtml(value=''){const div=document.createElement('div');div.textContent=value;return div.innerHTML}
function nextOrder(){return Math.max(0,...mergedAdminLessons().map(l=>Number(l.order||l.id)||0))+1}
function resetEditor(){
  editing=null;queue=[];$('#lessonForm').reset();$('#lessonDocId').value='';$('#lessonOrder').value=nextOrder();$('#lessonPublished').checked=true;$('#lessonQuizAnswer').value=1;$('#editorTitle').textContent='Nova microaula';$('#deleteLessonBtn').hidden=true;$('#editorStatus').textContent='';renderQueue();renderAdminList();
}
function editLesson(id){
  const l=mergedAdminLessons().find(x=>Number(x.id)===id);if(!l)return;editing=l;
  $('#lessonDocId').value=l.docId||'';$('#lessonOrder').value=l.order||l.id;$('#lessonTitle').value=l.title||'';$('#lessonShort').value=l.short||'';$('#lessonCategories').value=(l.cat||[]).join(', ');$('#lessonObjectives').value=(l.objectives||[]).join('\n');$('#lessonQuizQuestion').value=l.quiz?.q||'';$('#lessonQuizOptions').value=(l.quiz?.o||[]).join('\n');$('#lessonQuizAnswer').value=(Number(l.quiz?.a)||0)+1;$('#lessonPublished').checked=l.published!==false;$('#editorTitle').textContent=`Editar Microaula ${String(l.id).padStart(2,'0')}`;$('#deleteLessonBtn').hidden=false;
  queue=(l.slides||[]).map((url,i)=>({kind:'existing',url,storagePath:l.storagePaths?.[i]||'',name:`Tela ${i+1}`}));renderQueue();renderAdminList();
}
$('#newLessonBtn').onclick=resetEditor;$('#cancelEditBtn').onclick=resetEditor;
$('#lessonImages').onchange=event=>{[...event.target.files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).forEach(file=>queue.push({kind:'file',file,name:file.name,preview:URL.createObjectURL(file)}));event.target.value='';renderQueue()};
function renderQueue(){
  $('#imageQueue').innerHTML=queue.length?queue.map((item,i)=>`<article class="queue-item"><img src="${item.kind==='file'?item.preview:imagePath(item.url,editing)}" alt="Prévia da tela ${i+1}"><div><strong>${i===0?'CAPA • ':''}Tela ${i+1}</strong><small>${escapeHtml(item.name||'Imagem existente')}</small></div><div><button type="button" data-action="up" data-i="${i}" aria-label="Mover para cima">↑</button><button type="button" data-action="down" data-i="${i}" aria-label="Mover para baixo">↓</button><button type="button" data-action="remove" data-i="${i}" aria-label="Remover">×</button></div></article>`).join(''):'<p class="queue-empty">Selecione as imagens. Elas serão organizadas pelo nome do arquivo.</p>';
  $('#imageQueue').querySelectorAll('button').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i),action=b.dataset.action;if(action==='remove'){const [removed]=queue.splice(i,1);if(removed.preview)URL.revokeObjectURL(removed.preview)}else{const j=action==='up'?i-1:i+1;if(j>=0&&j<queue.length)[queue[i],queue[j]]=[queue[j],queue[i]]}renderQueue()});
}
function imagePath(url,lesson){return /^(https?:|blob:|data:)/.test(url||'')?url:`assets/microaulas/${String(lesson?.id||1).padStart(2,'0')}/${url}`}
function setProgress(done,total,text){$('#uploadProgress').hidden=false;$('#uploadProgressText').textContent=text;$('#uploadProgressBar').style.width=`${Math.round(done/Math.max(total,1)*100)}%`}

$('#lessonForm').onsubmit=async event=>{
  event.preventDefault();if(!user||user.uid!==ADMIN_UID)return;if(!queue.length){notify('Adicione pelo menos uma imagem.');return}
  const save=$('#saveLessonBtn');save.disabled=true;$('#editorStatus').textContent='Salvando...';
  try{
    const order=Number($('#lessonOrder').value),lessonId=order,docId=editing?.docId||`microaula-${String(lessonId).padStart(3,'0')}`,slides=[],storagePaths=[];let sent=0;
    for(const item of queue){
      if(item.kind==='existing'){slides.push(item.url);storagePaths.push(item.storagePath||'')}
      else{const objectPath=`microaulas/${docId}/${Date.now()}-${sent}-${safeName(item.file.name)}`;setProgress(sent,queue.filter(x=>x.kind==='file').length,`Enviando ${item.file.name}...`);await uploadBytes(ref(storage,objectPath),item.file,{contentType:item.file.type,customMetadata:{ownerUid:ADMIN_UID}});slides.push(await getDownloadURL(ref(storage,objectPath)));storagePaths.push(objectPath);sent++;}
    }
    const options=cleanLines($('#lessonQuizOptions').value),answer=Number($('#lessonQuizAnswer').value)-1;if(answer<0||answer>=options.length)throw new Error('correct-answer');
    const payload={id:lessonId,order,title:$('#lessonTitle').value.trim(),short:$('#lessonShort').value.trim(),cat:$('#lessonCategories').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),objectives:cleanLines($('#lessonObjectives').value),quiz:{q:$('#lessonQuizQuestion').value.trim(),o:options,a:answer},slides,storagePaths,published:$('#lessonPublished').checked,deleted:false,updatedAt:serverTimestamp(),updatedBy:user.uid};
    await setDoc(doc(db,'microaulas',docId),payload,{merge:true});setProgress(1,1,'Microaula organizada e publicada.');notify('Microaula salva com sucesso.');editing={...payload,docId,source:'firebase'};$('#editorStatus').textContent='Salvo';setTimeout(()=>$('#uploadProgress').hidden=true,1200);
  }catch(error){console.error(error);$('#editorStatus').textContent='Erro ao salvar';notify(error.message==='correct-answer'?'Indique uma alternativa correta válida.':error.code?.includes('storage')?'Ative o Storage/Plano Blaze e publique as regras.':'Não foi possível salvar. Confira as regras do Firebase.')}
  finally{save.disabled=false}
};

$('#deleteLessonBtn').onclick=async()=>{
  if(!editing||!user||!confirm(`Excluir a Microaula ${editing.id}?`))return;
  try{for(const objectPath of editing.storagePaths||[]){if(objectPath)await deleteObject(ref(storage,objectPath)).catch(()=>{})}const docId=editing.docId||`microaula-${String(editing.id).padStart(3,'0')}`;await setDoc(doc(db,'microaulas',docId),{id:editing.id,order:editing.order||editing.id,deleted:true,published:false,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});notify('Microaula removida.');resetEditor()}
  catch(error){console.error(error);notify('Não foi possível excluir. Confira as regras do Firebase.')}
};

