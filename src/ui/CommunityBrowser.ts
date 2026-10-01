import { CommunityApi, CommunityLibrary, COMMUNITY_CLIENT_MAX_BYTES } from '../online/community-client';
import type { CommunityInstalledRecord } from '../online/community-client';
import type { CommunityPackageDetail, CommunityPackageKind, CommunityPreview, CommunityRevision } from '../server/community-packages';
import type { Account } from '../online/protocol';
import './community-browser.css';

export interface CommunityBrowserOptions {
 api?:CommunityApi;library:CommunityLibrary;play:(record:CommunityInstalledRecord)=>void|Promise<void>;
 toolbar?:HTMLElement;blocked?:()=>boolean;
 getPublishedPackage?:()=>unknown;getPublishedScenario?:()=>unknown;onOpen?:(open:boolean)=>void;
}
export interface CommunityBrowser {open:()=>void;close:()=>void;destroy:()=>void}
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;if(className)value.className=className;return value;}
function field(parent:HTMLElement,label:string,control:HTMLElement):void{const wrapper=node('label',label);wrapper.append(control);control.setAttribute('aria-label',label);parent.append(wrapper);}
function button(parent:HTMLElement,label:string,action:()=>void):HTMLButtonElement{const value=node('button',label);value.type='button';value.addEventListener('click',action);parent.append(value);return value;}
const COLORS:Record<string,string>={grass:'#597752',road:'#b0a380',mud:'#655e47',shallows:'#5d9698',water:'#305675',rock:'#41424a',bridge:'#a18460',sand:'#c9b576',snow:'#bccdd3',forest:'#294b35',ice:'#9ac7d5'};
function paintPreview(parent:HTMLElement,preview:CommunityPreview):void{
 if(preview.type==='scenario'){parent.append(node('p',`${preview.actors} actors, ${preview.objectives} objectives, ${preview.events} events.`));paintPreview(parent,preview.map);return;}
 if(preview.type==='mod'){
  const factions=node('ul');for(const faction of preview.factions.slice(0,16)){const row=node('li',`${faction.name}: ${faction.units} custom units and ${faction.buildings} buildings.`);factions.append(row);}parent.append(factions);return;
 }
 if(preview.type!=='map'||!Array.isArray(preview.levels))return;
 for(const level of preview.levels.slice(0,2)){
  if(!Number.isSafeInteger(level.columns)||!Number.isSafeInteger(level.rows)||level.columns<1||level.rows<1||level.columns>32||level.rows>32||!Array.isArray(level.terrain)||level.terrain.length!==level.columns*level.rows)continue;
  const canvas=node('canvas');canvas.width=256;canvas.height=256;canvas.setAttribute('aria-label',`Map preview level ${level.id+1}`);const context=canvas.getContext('2d');if(!context)continue;
  for(let y=0;y<level.rows;y++)for(let x=0;x<level.columns;x++){context.fillStyle=COLORS[level.terrain[y*level.columns+x]]??'#41424a';context.fillRect(x*256/level.columns,y*256/level.rows,Math.ceil(256/level.columns),Math.ceil(256/level.rows));}
  if(Array.isArray(preview.starts))for(const point of preview.starts.slice(0,8)){if(point.level!==level.id||!Number.isFinite(point.x)||!Number.isFinite(point.y)||preview.width<=0||preview.height<=0)continue;const x=point.x/preview.width*256,y=point.y/preview.height*256;context.fillStyle='#fff';context.strokeStyle='#111';context.lineWidth=2;context.beginPath();context.arc(x,y,5,0,Math.PI*2);context.fill();context.stroke();}
  parent.append(canvas);
 }
 parent.append(node('p',`${preview.width} × ${preview.height}, ${preview.levels.length} levels.`));
}

/** Browsing, installation and publication use the same account cookie as online matches. */
export function mountCommunityBrowser(root:HTMLElement,options:CommunityBrowserOptions):CommunityBrowser {
 const api=options.api??new CommunityApi(),entry=button(options.toolbar??root,'Community packages',()=>open());entry.classList.add('community-entry');
 const overlay=node('section',undefined,'community-overlay');overlay.hidden=true;const dialog=node('section',undefined,'community-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Community packages');dialog.tabIndex=-1;
 const header=node('header');header.append(node('h2','Community packages'));const closeButton=button(header,'Close community',()=>close());
 const status=node('p',undefined,'community-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const auth=node('form',undefined,'community-auth');auth.setAttribute('aria-label','Community account');const username=node('input');username.name='username';username.autocomplete='username';username.minLength=3;username.maxLength=32;username.required=true;username.pattern='[-_a-zA-Z0-9]{3,32}';field(auth,'Community username',username);
 const password=node('input');password.name='password';password.type='password';password.autocomplete='current-password';password.minLength=8;password.maxLength=128;password.required=true;field(auth,'Community password',password);
 const signIn=node('button','Sign in');signIn.type='submit';auth.append(signIn);button(auth,'Create community account',()=>void authenticate(true));
 const signed=node('section',undefined,'community-account');signed.hidden=true;const accountLabel=node('p');signed.append(accountLabel);button(signed,'Sign out',()=>void run(async()=>{await api.auth.logout();account=null;refreshAccount();}));
 const search=node('form',undefined,'community-search');search.setAttribute('aria-label','Search community packages');const query=node('input');query.maxLength=120;field(search,'Search packages',query);
 const kinds=node('select');for(const [value,label] of [['','All packages'],['map','Maps'],['scenario','Scenarios'],['mod','Mods']]){const option=node('option',label);option.value=value;kinds.append(option);}field(search,'Package kind',kinds);const searchButton=node('button','Search community');searchButton.type='submit';search.append(searchButton);
 const layout=node('div',undefined,'community-layout'),results=node('section',undefined,'community-results'),details=node('section',undefined,'community-details');results.setAttribute('aria-label','Published packages');details.setAttribute('aria-label','Package details');layout.append(results,details);
 const pagination=node('div',undefined,'community-pagination'),previous=button(pagination,'Previous page',()=>void loadPage(page-1)),pageLabel=node('span'),next=button(pagination,'Next page',()=>void loadPage(page+1));pagination.insertBefore(pageLabel,next);
 const installed=node('section',undefined,'community-installed');installed.setAttribute('aria-label','Installed packages');
 const publishing=node('section',undefined,'community-publishing');publishing.append(node('h3','Publish a package'),node('p','Published versions remain available. Increase the revision or version when changing a package.'));
 const file=node('input');file.type='file';file.accept='.json,application/json';field(publishing,'Package file to publish',file);
 if(options.getPublishedPackage)button(publishing,'Publish current map',()=>void publish(options.getPublishedPackage!));if(options.getPublishedScenario)button(publishing,'Publish current scenario',()=>void publish(options.getPublishedScenario!));
 dialog.append(header,status,auth,signed,search,layout,pagination,installed,publishing);overlay.append(dialog);root.append(overlay);
 let account:Account|null=null,busy=false,disposed=false,page=1,total=0,selected:CommunityPackageDetail|undefined,selectedVersion='',previousFocus:HTMLElement|null=null;
 function notice(text:string):void{if(!disposed)status.textContent=text;}
 function refreshAccount():void{auth.hidden=!!account;signed.hidden=!account;accountLabel.textContent=account?`Signed in as ${account.username}.`:'';for(const control of Array.from(publishing.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button')))control.disabled=busy||!account;}
 function refreshBusy():void{for(const control of Array.from(dialog.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button')))if(control!==closeButton)control.disabled=busy;refreshAccount();previous.disabled=busy||page<=1;next.disabled=busy||page*20>=total;}
 async function run(action:()=>Promise<void>):Promise<void>{if(busy||disposed)return;busy=true;refreshBusy();try{await action();}catch(error){notice(error instanceof Error?error.message:'Community operation failed.');}finally{busy=false;if(!disposed){refreshBusy();renderInstalled();renderDetails();}}}
 async function authenticate(register:boolean):Promise<void>{if(!auth.reportValidity())return;const name=username.value,secret=password.value;await run(async()=>{try{account=register?await api.auth.register(name,secret):await api.auth.login(name,secret);refreshAccount();notice(`Signed in as ${account.username}.`);}finally{password.value='';}});if(account&&!disposed)await loadPage();}
 auth.addEventListener('submit',event=>{event.preventDefault();void authenticate(false);});
 async function loadPage(target=1):Promise<void>{await run(async()=>{const response=await api.search({query:query.value,kind:kinds.value?kinds.value as CommunityPackageKind:undefined,page:target,pageSize:20});if(disposed)return;page=response.page;total=response.total;results.replaceChildren(node('h3','Published packages'));for(const item of response.items){const row=node('article');row.append(node('h4',item.title),node('p',`${item.kind} · ${item.publisher.username} · version ${item.version}`));button(row,'View package',()=>void run(async()=>{selected=await api.detail(item.id);selectedVersion=selected.version;renderDetails();}));results.append(row);}if(!response.items.length)results.append(node('p','No packages matched this search.'));pageLabel.textContent=`Page ${page} · ${total} packages`;notice(`Loaded ${response.items.length} published packages.`);});}
 search.addEventListener('submit',event=>{event.preventDefault();void loadPage();});
 function selectedRevision():CommunityRevision|undefined{return selected?.revisions.find(revision=>revision.version===selectedVersion);}
 function renderDetails():void{
  details.replaceChildren();if(!selected){details.append(node('p','Choose a package to view its revisions.'));return;}
  details.append(node('h3',selected.title),node('p',`Published by ${selected.publisher.username}.`));const versions=node('select');for(const revision of selected.revisions){const option=node('option',`Version ${revision.version} — ${revision.title}`);option.value=revision.version;versions.append(option);}versions.value=selectedVersion;field(details,'Published revision',versions);versions.addEventListener('change',()=>{selectedVersion=versions.value;renderDetails();});
  const revision=selectedRevision();if(!revision)return;details.append(node('p',`Simulation version ${revision.simulationVersion}`),node('p',`Download checksum ${revision.hash}`,'community-hash'));const preview=node('div',undefined,'community-preview');paintPreview(preview,revision.preview);details.append(preview);
  const deps=node('ul');for(const dependency of revision.dependencies)deps.append(node('li',`${dependency.kind}: ${dependency.localId} ${dependency.version} · ${dependency.hash}`));details.append(node('h4','Pinned dependencies'),revision.dependencies.length?deps:node('p','None.'));
  const record=options.library.get(revision.hash);details.append(node('p',record?`Installed version ${record.version}. This revision remains pinned on this device.`:'This revision is not installed.'));
  const install=button(details,record?'Verify and reinstall revision':'Download and install',()=>{const target=selected!,version=selectedVersion;void run(async()=>{const installed=await options.library.install(api,target,version);notice(`Installed ${installed.title}, version ${installed.version}.`);});});install.disabled=busy;
  if(record){const play=button(details,'Play installed revision',()=>void playInstalled(record));play.disabled=busy;}
  versions.disabled=busy;
 }
 async function playInstalled(record:CommunityInstalledRecord):Promise<void>{await run(async()=>{await options.play(record);notice(`Loaded ${record.title}, version ${record.version}.`);close();});}
 function renderInstalled():void{installed.replaceChildren(node('h3','Installed revisions'));for(const record of options.library.list()){const row=node('article');row.append(node('p',`${record.title} · ${record.kind} · version ${record.version}`),node('p',record.hash,'community-hash'));const play=button(row,'Play saved revision',()=>void playInstalled(record));play.disabled=busy;installed.append(row);}if(!options.library.list().length)installed.append(node('p','No community revisions installed on this device.'));}
 async function publish(getPackage:()=>unknown):Promise<void>{await run(async()=>{if(!account)throw new Error('Sign in before publishing a package.');const result=await api.publish(getPackage());selected=result.detail;selectedVersion=selected.version;notice(result.created?'Package published. Existing revisions remain available.':'This exact revision is already published.');});}
 file.addEventListener('change',()=>{const upload=file.files?.[0];file.value='';if(!upload)return;void run(async()=>{if(!account)throw new Error('Sign in before publishing a package.');if(upload.size>COMMUNITY_CLIENT_MAX_BYTES)throw new Error('Package exceeds the 16 MiB limit.');const result=await api.publish(await upload.text());selected=result.detail;selectedVersion=selected.version;notice(result.created?'Package file published.':'This exact revision is already published.');});});
 function close():void{if(overlay.hidden)return;overlay.hidden=true;options.onOpen?.(false);previousFocus?.focus();}
 function open():void{if(disposed||!overlay.hidden||options.blocked?.())return;previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:entry;overlay.hidden=false;options.onOpen?.(true);dialog.focus();void run(async()=>{await options.library.ready();account=await api.auth.session();refreshAccount();renderInstalled();if(!account){notice('Sign in to browse, install and publish community packages.');return;}const response=await api.search({page:1,pageSize:20});if(disposed)return;page=response.page;total=response.total;results.replaceChildren(node('h3','Published packages'));for(const item of response.items){const row=node('article');row.append(node('h4',item.title),node('p',`${item.kind} · ${item.publisher.username} · version ${item.version}`));button(row,'View package',()=>void run(async()=>{selected=await api.detail(item.id);selectedVersion=selected.version;}));results.append(row);}if(!response.items.length)results.append(node('p','No packages are published yet.'));pageLabel.textContent=`Page ${page} · ${total} packages`;notice(`Signed in as ${account.username}.`);});}
 const keydown=(event:KeyboardEvent)=>{if(overlay.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}if(event.key==='Tab'){const focusable=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]')).filter(element=>!element.closest('[hidden]'));const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};dialog.addEventListener('keydown',keydown);overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)close();});
 renderInstalled();renderDetails();refreshAccount();refreshBusy();return {open,close,destroy(){close();disposed=true;entry.remove();overlay.remove();}};
}
