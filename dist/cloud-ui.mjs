import {createCloudClient} from './cloud.mjs';
import {SyncRepository,SupabaseRemote} from './sync.mjs';

const labels={synced:'Synced online',syncing:'Syncing…',pending:'Saved on this device · Waiting to sync',conflict:'Changes need review · Open Settings'};
export class CloudController{
 constructor({store,lock,activate,refresh,showConfirm,notify,download,escape}){Object.assign(this,{store,lock,activate,refresh,showConfirm,notify,download,escape});this.client=null;this.user=null;this.repository=null;this.status='';this.interval=null;this.sessionQueue=Promise.resolve();this.lastError='';}
 async init(){
  try{
   this.client=await createCloudClient();if(!this.client)return;
   const {data,error}=await this.client.auth.getSession();if(error)throw error;
   await this.setSession(data.session);
   this.client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>this.setSession(session).catch(()=>this.notify('Could not open this account. Please retry signing in.')),0);});
   window.addEventListener('online',()=>this.repository?.sync());
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.repository?.sync();});
   this.interval=setInterval(()=>{if(!document.hidden)this.repository?.sync();},30000);
  }catch{this.notify('Online sync is unavailable. Your device data is unchanged.');}
 }
 setSession(session){
  this.sessionQueue=this.sessionQueue.catch(()=>{}).then(()=>this.applySession(session));return this.sessionQueue;
 }
 async applySession(session){
  const user=session?.user||null;
  if(user?.id===this.user?.id)return;
  await this.lock(async()=>{this.repository?.close();this.user=user;this.repository=null;this.status='';});
  if(!user){await this.activate(this.store);return;}
  const repository=new SyncRepository({store:this.store,remote:new SupabaseRemote(this.client,user.id),userId:user.id,lock:this.lock,
   onStatus:(status,error)=>{if(this.repository===repository){this.status=status;this.lastError=error?.message||'';this.updateStatus();}},
   onChange:async()=>{if(this.repository===repository)await this.refresh(repository);}});
  this.repository=repository;
  await this.activate(repository);
  await repository.sync();
 }
 updateStatus(){
  for(const node of document.querySelectorAll('[data-sync-status]'))node.textContent=labels[this.status]||'Checking online copy…';
  for(const node of document.querySelectorAll('[data-sync-error]'))node.textContent=this.lastError;
  for(const node of document.querySelectorAll('[data-sync-conflict]'))node.hidden=this.status!=='conflict';
 }
 banner(){return this.user?'<p class="sync-banner" role="status" data-sync-status>'+this.escape(labels[this.status]||'Checking online copy…')+'</p>':'';}
 section(){
  const head='<section class="card settings-card"><h2>Online sync</h2>';
  if(!this.client)return head+'<p class="muted">This build saves on this device. Online sync has not been connected yet.</p></section>';
  if(!this.user)return head+'<p class="muted">Sign in to keep the same expenses and income on your phone and computer. Your existing device data stays separate until you import a backup into your account.</p><div class="button-row"><button class="primary" data-action="cloud-signin">Sign in</button><button class="secondary" data-action="cloud-signup">Create account</button></div></section>';
  return head+'<p class="account-email">'+this.escape(this.user.email||'Signed in')+'</p><p class="muted" role="status" data-sync-status>'+this.escape(labels[this.status]||'Checking online copy…')+'</p><p class="muted" data-sync-error>'+this.escape(this.lastError)+'</p><div class="button-row"><button class="secondary" data-action="cloud-sync">Sync now</button><button class="secondary" data-action="cloud-signout">Sign out</button></div><div class="sync-conflict" data-sync-conflict '+(this.status==='conflict'?'':'hidden')+'><p>Both devices changed the same information. Export a backup before choosing a copy.</p><div class="button-row"><button class="secondary" data-action="cloud-keep-online">Keep online copy</button><button class="secondary" data-action="cloud-keep-device">Keep this device’s copy</button></div></div><small>Changes save on this device first, then sync online. Keep JSON backups too.</small></section>';
 }
 async action(action){
  if(!action.startsWith('cloud-'))return false;
  if(!this.client)throw new Error('Online sync is not connected yet.');
  switch(action){
   case 'cloud-signin':case 'cloud-signup':{
    const signup=action==='cloud-signup';
    this.showConfirm(signup?'Create your account':'Sign in to sync',signup?'Use your email and choose a password. Check your email to confirm the account before signing in.':'Use the same account on your phone and computer.',
     '<label class="field">Email<input name="email" type="email" autocomplete="email" required></label><label class="field">Password<input name="password" type="password" minlength="8" autocomplete="'+(signup?'new-password':'current-password')+'" required></label>',async data=>{
      const credentials={email:String(data.get('email')).trim(),password:String(data.get('password'))};
      const result=signup?await this.client.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+'/'}}):await this.client.auth.signInWithPassword(credentials);
      if(result.error)throw new Error(result.error.message);
      if(result.data.session)await this.setSession(result.data.session);
      this.notify(signup&&!result.data.session?'Check your email to confirm your account.':'Signed in');
     },signup?'Create account':'Sign in');break;
   }
   case 'cloud-signout':{
    const repository=this.repository;
    if(repository){await repository.sync();const record=await repository.record();if(record.pending)throw new Error('Some changes are only on this device. Sync or export a backup before signing out.');}
    const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;await this.setSession(null);this.notify('Signed out');break;
   }
   case 'cloud-sync':{const result=await this.repository?.sync();if(result?.error)throw new Error(result.error.message||'Could not sync. Your changes are still saved on this device.');this.notify('Synced online');break;}
   case 'cloud-keep-online':case 'cloud-keep-device':{
    const repository=this.repository;if(!repository)throw new Error('Sign in first.');
    const online=action==='cloud-keep-online';
    this.showConfirm('Choose your tracker copy',online?'Keep the online copy and replace this device’s pending changes? A backup of your device copy will download first.':'Replace the online copy with this device’s copy? A backup of the online copy will download first.','',async()=>{
     const backup=online?await repository.load():(await repository.remote.read())?.state;
     if(backup)this.download(JSON.stringify(backup,null,2),'application/json','iqbal-saku-before-sync-resolution.json');
     await (online?repository.keepOnline():repository.keepDevice());this.notify('Tracker copy updated');
    },online?'Keep online copy':'Keep device copy');break;
   }
  }
  return true;
 }
}
