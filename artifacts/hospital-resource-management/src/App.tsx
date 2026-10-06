import './app.css';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BedDouble,
  Bell, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardList, Clock3, Droplets, ExternalLink, FileClock, Filter, HeartPulse,
  LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Package, Plus, Search,
  Settings2, ShieldCheck, Sparkles, Sun, Syringe, Wind, X, Zap,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey, getGetDashboardQueryKey, getGetProfileQueryKey,
  getGetResourceQueryKey, getListAiHistoryQueryKey, getListAlertsQueryKey,
  getListHistoryQueryKey, getListResourcesQueryKey, useChangePassword,
  useCreateActionPlan, useCreateChecklist, useCreateResource, useDeleteResource,
  useGetCurrentUser, useGetDashboard, useGetProfile, useGetResource,
  useListAiHistory, useListAlerts, useListHistory, useListResources,
  useLogin, useLogout, useMarkAlertRead, useRegister, useRestoreResource,
  useRunAiAnalysis, useUpdateProfile, useUpdateResource,
} from '@workspace/api-client-react';
import type {
  Analysis, AnalysisInput, Alert, DashboardSummary, HistoryItem, ListAlertsParams,
  ListHistoryParams, ListResourcesParams, ProfileUpdate, Resource, ResourceInput,
  ResourceType, User,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const resourceTypes: ResourceType[] = ['icu-beds', 'oxygen', 'ventilators', 'medicines', 'blood'];
const resourceMeta: Record<ResourceType, { title: string; singular: string; icon: typeof BedDouble; hint: string; fields: { key: string; label: string; type?: string; options?: string[] }[] }> = {
  'icu-beds': { title: 'ICU beds', singular: 'ICU bed', icon: BedDouble, hint: 'Critical care capacity and occupancy', fields: [{key:'bedId',label:'Bed ID'}, {key:'ward',label:'Ward / unit'}, {key:'status',label:'Status',options:['available','occupied','maintenance','critical']}, {key:'patientId',label:'Patient reference'}, {key:'notes',label:'Notes'}] },
  oxygen: { title: 'Oxygen equipment', singular: 'Oxygen unit', icon: Wind, hint: 'Oxygen cylinders, concentrators and flow capacity', fields: [{key:'name',label:'Equipment name'}, {key:'type',label:'Equipment type'}, {key:'location',label:'Location'}, {key:'status',label:'Status',options:['available','in-use','maintenance','critical']}, {key:'quantity',label:'Quantity',type:'number'}, {key:'lastServiced',label:'Last serviced',type:'date'}] },
  ventilators: { title: 'Ventilators', singular: 'Ventilator', icon: Activity, hint: 'Availability, assignment and maintenance status', fields: [{key:'name',label:'Equipment name'}, {key:'assetId',label:'Asset ID'}, {key:'location',label:'Location'}, {key:'status',label:'Status',options:['available','in-use','maintenance','critical']}, {key:'lastServiced',label:'Last serviced',type:'date'}] },
  medicines: { title: 'Medicines', singular: 'Medicine item', icon: Syringe, hint: 'Stock levels and near-term expiry exposure', fields: [{key:'name',label:'Medicine name'}, {key:'category',label:'Category'}, {key:'quantity',label:'Quantity',type:'number'}, {key:'reorderLevel',label:'Reorder level',type:'number'}, {key:'unit',label:'Unit'}, {key:'location',label:'Storage location'}, {key:'expiryDate',label:'Expiry date',type:'date'}] },
  blood: { title: 'Blood bank', singular: 'Blood unit', icon: Droplets, hint: 'Blood group availability and expiry outlook', fields: [{key:'bloodGroup',label:'Blood group',options:['A+','A-','B+','B-','AB+','AB-','O+','O-']}, {key:'quantity',label:'Units',type:'number'}, {key:'location',label:'Storage location'}, {key:'expiryDate',label:'Expiry date',type:'date'}, {key:'status',label:'Status',options:['available','reserved','critical']}] },
};

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Switch>
    <Route path="/login"><AuthPage mode="login" /></Route>
    <Route path="/register"><AuthPage mode="register" /></Route>
    <Route><ProtectedShell /></Route>
  </Switch><Toaster /></TooltipProvider></QueryClientProvider>;
}

function ProtectedShell() {
  const [loc, setLocation] = useLocation();
  const { data: user, isLoading: loadingUser, error: userError, refetch } = useGetCurrentUser();
  const [dark, setDark] = useState(() => localStorage.getItem('hrm-theme') === 'dark');
  const [mobileNav, setMobileNav] = useState(false);
  const logout = useLogout();
  const queryClient = useQueryClient();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('hrm-theme', dark ? 'dark' : 'light');
  }, [dark]);
  if (loc === '/login' || loc === '/register') return <Switch><Route path="/login"><AuthPage mode="login" /></Route><Route path="/register"><AuthPage mode="register" /></Route></Switch>;
  if (loadingUser) return <div className="min-h-[100dvh] grid place-items-center p-6"><div className="w-full max-w-3xl space-y-5"><div className="skeleton h-12 w-56"/><div className="grid gap-4 md:grid-cols-3"><div className="skeleton h-36"/><div className="skeleton h-36"/><div className="skeleton h-36"/></div><div className="skeleton h-72"/></div></div>;
  if (userError || !user) return <div className="min-h-[100dvh] grid place-items-center p-6"><section className="panel max-w-md text-center"><div className="icon-tile mx-auto mb-4"><ShieldCheck size={23}/></div><h1 className="text-xl font-bold">Sign in to your command center</h1><p className="mt-2 text-sm text-muted-foreground">Your hospital workspace is protected. Continue with your staff account.</p><Link href="/login" className="btn btn-primary mt-6">Continue to sign in</Link></section></div>;
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { queryClient.removeQueries(); setLocation('/login'); } });
  const toggleTheme = () => setDark((v) => !v);
  return <div className="app-frame">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <Link href="/" className="brand"><span className="brand-mark"><HeartPulse size={21}/></span><span><b>Wardwell</b><small>OPERATIONS</small></span></Link>
      <div className="hospital-switch"><span className="hospital-avatar">{user.hospitalName.slice(0,1).toUpperCase()}</span><div className="min-w-0"><strong>{user.hospitalName}</strong><small>Hospital workspace</small></div><ChevronDown size={15}/></div>
      <nav aria-label="Main navigation" className="nav-groups">
        <p className="nav-label">WORKSPACE</p>
        <NavItem href="/" active={loc === '/'} icon={<LayoutDashboard/>}>Overview</NavItem>
        <p className="nav-label nav-label-spaced">RESOURCES</p>
        {resourceTypes.map((type) => { const Icon = resourceMeta[type].icon; return <NavItem key={type} href={`/resources/${type}`} active={loc === `/resources/${type}`} icon={<Icon/>}>{resourceMeta[type].title}</NavItem>; })}
        <p className="nav-label nav-label-spaced">OPERATIONS</p>
        <NavItem href="/alerts" active={loc === '/alerts'} icon={<Bell/>}>Alerts</NavItem>
        <NavItem href="/history" active={loc === '/history'} icon={<FileClock/>}>Audit history</NavItem>
        <NavItem href="/ai" active={loc === '/ai'} icon={<Sparkles/>}>AI intelligence</NavItem>
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item sidebar-action" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}><span className="nav-icon">{dark ? <Sun/> : <Moon/>}</span><span>{dark ? 'Light appearance' : 'Dark appearance'}</span></button>
        <NavItem href="/settings" active={loc === '/settings'} icon={<Settings2/>}>Preferences</NavItem>
        <div className="user-strip"><div className="user-avatar">{user.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div><div className="user-copy"><b>{user.name}</b><small>{roleName(user.role)}</small></div><button className="icon-btn" aria-label="Sign out" onClick={signOut}><LogOut size={17}/></button></div>
      </div>
    </aside>
    {mobileNav && <button aria-label="Close navigation" className="mobile-scrim" onClick={()=>setMobileNav(false)}/>}
    <div className="main-column">
      <header className="topbar">
        <button aria-label="Open navigation" className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button>
        <div className="crumb"><span>Operations</span><span className="crumb-slash">/</span><strong>{pageTitle(loc)}</strong></div>
        <div className="top-actions"><div className="live-indicator"><span/> Live operations</div><Link href="/alerts" aria-label="Open alerts" className="icon-btn top-bell"><Bell size={18}/></Link><Link href="/profile" className="top-user"><span>{user.name.slice(0,1).toUpperCase()}</span><b>{user.name.split(' ')[0]}</b></Link></div>
      </header>
      <main className="content-area" id="main-content" tabIndex={-1}>
        <Switch>
          <Route path="/" component={DashboardPage}/>
          <Route path="/resources/:type"><ResourcePage/></Route>
          <Route path="/alerts" component={AlertsPage}/>
          <Route path="/history" component={HistoryPage}/>
          <Route path="/ai" component={AiPage}/>
          <Route path="/profile" component={ProfilePage}/>
          <Route path="/settings"><SettingsPage dark={dark} onToggleTheme={toggleTheme}/></Route>
          <Route component={NotFound}/>
        </Switch>
      </main>
    </div>
  </div>;
}

function NavItem({href,active,icon,children}:{href:string;active:boolean;icon:ReactNode;children:ReactNode}) {
  return <Link href={href} className={`nav-item ${active?'nav-active':''}`} aria-current={active?'page':undefined}><span className="nav-icon">{icon}</span><span>{children}</span></Link>;
}
function roleName(role: string) { return role.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,(x)=>x.toUpperCase()); }
function pageTitle(path: string) { if(path.startsWith('/resources/')) return resourceMeta[path.split('/')[2] as ResourceType]?.title ?? 'Resources'; return ({'/':'Overview','/alerts':'Alert center','/history':'Audit history','/ai':'AI intelligence','/profile':'My profile','/settings':'Preferences'} as Record<string,string>)[path] ?? 'Operations'; }
function PageHeading({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:ReactNode}) { return <div className="page-heading animate-rise"><div><p className="eyebrow">{eyebrow ?? 'HOSPITAL OPERATIONS'}</p><h1>{title}</h1>{description&&<p className="page-description">{description}</p>}</div>{action&&<div className="heading-action">{action}</div>}</div>; }
function Button({children,onClick,kind='secondary',disabled=false,type='button',className='',...rest}:{children:ReactNode;onClick?:()=>void;kind?:'primary'|'secondary'|'quiet'|'danger';disabled?:boolean;type?:'button'|'submit';className?:string;['aria-label']?:string}) { return <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${kind} ${className}`} {...rest}>{children}</button>; }
function ErrorState({message='We could not load this information.',retry}:{message?:string;retry?:()=>void}) { return <div className="state-card"><div className="state-icon error"><AlertCircle size={21}/></div><h3>Something needs another try</h3><p>{message}</p>{retry&&<Button onClick={retry}>Try again</Button>}</div>; }
function EmptyState({title,copy,action}:{title:string;copy:string;action?:ReactNode}) { return <div className="empty-state"><div className="empty-mark"><Package size={23}/></div><h3>{title}</h3><p>{copy}</p>{action}</div>; }
function SkeletonRows() { return <div className="space-y-3 p-5"><div className="skeleton h-9"/><div className="skeleton h-12"/><div className="skeleton h-12"/><div className="skeleton h-12"/></div>; }

function DashboardPage() {
  const {data:summary,isLoading,error,refetch}=useGetDashboard();
  if(isLoading) return <div className="page-stack"><div className="skeleton h-28"/><div className="grid gap-4 md:grid-cols-3"><div className="skeleton h-36"/><div className="skeleton h-36"/><div className="skeleton h-36"/></div><div className="skeleton h-72"/></div>;
  if(error||!summary) return <ErrorState retry={()=>void refetch()}/>;
  const counts=Object.values(summary.resources);
  const total=counts.reduce((n,c)=>n+c.total,0);
  const critical=counts.reduce((n,c)=>n+c.critical,0);
  const available=counts.reduce((n,c)=>n+c.available,0);
  const stats=[{label:'Tracked resources',value:total,sub:'Across 5 clinical categories',icon:<Package/>,tone:'blue'},{label:'Available now',value:available,sub:total?`${Math.round(available/total*100)}% of tracked inventory`:'No inventory recorded',icon:<Check/>,tone:'teal'},{label:'Needs attention',value:critical,sub:`${summary.activeAlerts} active alerts`,icon:<AlertTriangle/>,tone:critical?'amber':'green'}];
  return <div className="page-stack">
    <PageHeading eyebrow="OPERATIONS OVERVIEW" title="Good morning" description={`${summary.hospitalName} · A clear view of today's capacity and readiness.`} action={<div className="date-chip"><Clock3 size={15}/>{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date())}</div>}/>
    <section className="overview-ribbon"><div className="ribbon-copy"><span className="ribbon-symbol"><ShieldCheck size={20}/></span><div><b>Situational awareness</b><span>{critical ? `${critical} critical resource${critical===1?'':'s'} need attention.` : 'No critical resource risks are currently reported.'} Check alerts for time-sensitive changes.</span></div></div><Link href="/alerts" className="ribbon-link">Review alerts <ChevronRight size={15}/></Link></section>
    <div className="stat-grid">{stats.map((s,i)=><article key={s.label} className={`stat-card animate-rise stat-${s.tone}`} style={{animationDelay:`${i*70}ms`}}><div className="stat-top"><span>{s.label}</span><i>{s.icon}</i></div><strong>{s.value.toLocaleString()}</strong><small>{s.sub}</small></article>)}</div>
    <section className="resource-overview">
      <div className="section-heading"><div><p className="eyebrow">CAPACITY & STOCK</p><h2>Resource readiness</h2></div><span className="section-note">Live inventory</span></div>
      <div className="readiness-list">{resourceTypes.map((type,i)=>{const c=summary.resources[toResourceKey(type)];const meta=resourceMeta[type];const Icon=meta.icon;const ratio=c.total?Math.min(c.available/c.total*100,100):0;return <Link key={type} href={`/resources/${type}`} className="readiness-row animate-rise" style={{animationDelay:`${i*45}ms`}}><span className="readiness-icon"><Icon size={19}/></span><span className="readiness-name"><b>{meta.title}</b><small>{c.total} tracked · {c.inUse} in use</small></span><span className="readiness-meter"><i><span style={{width:`${ratio}%`}}/></i><small>{Math.round(ratio)}% available</small></span><span className="readiness-flags"><StatusCount count={c.critical} label="critical" tone="red"/><StatusCount count={c.warning} label="warning" tone="amber"/></span><ChevronRight className="row-chevron" size={17}/></Link>;})}</div>
    </section>
    <div className="dashboard-bottom">
      <section className="panel activity-panel"><div className="section-heading compact"><div><p className="eyebrow">RECENT CHANGES</p><h2>Activity</h2></div><Link href="/history" className="text-link">Full history <ChevronRight size={15}/></Link></div>{summary.recentActivity.length?<div className="activity-list">{summary.recentActivity.slice(0,5).map((item)=><ActivityRow item={item} key={item.id}/>)}</div>:<EmptyState title="No recent activity" copy="Changes to resource records will appear here."/>}</section>
      <section className="readiness-side"><div className="side-card side-ai"><div className="side-card-top"><span className="icon-tile teal"><Sparkles size={18}/></span><span className="side-kicker">RESOURCE INTELLIGENCE</span></div><h3>Make the next move clearer.</h3><p>Review current inventory signals and get practical, risk-ranked guidance.</p><Link href="/ai" className="btn btn-dark">Open intelligence <ArrowUp size={15}/></Link></div><div className="side-card mini-alert"><div className="mini-alert-icon"><Bell size={18}/></div><div><small>ALERT CENTER</small><strong>{summary.activeAlerts} active alerts</strong></div><Link href="/alerts" aria-label="View active alerts"><ChevronRight size={18}/></Link></div></section>
    </div>
  </div>;
}
function toResourceKey(type:ResourceType):'icuBeds'|'oxygen'|'ventilators'|'medicines'|'blood' { return type==='icu-beds'?'icuBeds':type; }
function StatusCount({count,label,tone}:{count:number;label:string;tone:string}) { return count>0?<span className={`status-count ${tone}`}><i/>{count} {label}</span>:null; }
function ActivityRow({item}:{item:HistoryItem}) { return <div className="activity-row"><span className={`activity-dot ${item.action.toLowerCase()}`}/><div className="activity-copy"><b>{item.actorName}</b><span>{item.action.toLowerCase()} <strong>{resourceMeta[item.resourceType]?.singular ?? item.resourceType}</strong></span></div><time>{timeAgo(item.createdAt)}</time></div>; }
function timeAgo(date:string) { const mins=Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/60000)); if(mins<1)return 'Just now'; if(mins<60)return `${mins}m ago`; if(mins<1440)return `${Math.floor(mins/60)}h ago`; return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(date)); }

function ResourcePage() {
  const params=useParams<{type:string}>();
  const type=params.type as ResourceType;
  const meta=resourceMeta[type];
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [expiry,setExpiry]=useState<'any'|'soon'|'expired'|'any'>('any');
  const [includeArchived,setIncludeArchived]=useState(false);
  const [sort,setSort]=useState('updatedAt');
  const [direction,setDirection]=useState<'asc'|'desc'>('desc');
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<Resource|null>(null);
  const [formOpen,setFormOpen]=useState(false);
  const [editing,setEditing]=useState<Resource|null>(null);
  const [formData,setFormData]=useState<Record<string,string>>({});
  const queryClient=useQueryClient();
  const paramsObj=useMemo<ListResourcesParams>(()=>({q:search||undefined,status:status||undefined,expiry:expiry==='any'?undefined:expiry,includeArchived,sort,direction,page,limit:12}),[search,status,expiry,includeArchived,sort,direction,page]);
  const list=useListResources(type,paramsObj);
  const detail=useGetResource(type,selected?.id??'',{query:{enabled:!!selected?.id,queryKey:getGetResourceQueryKey(type,selected?.id??'')}});
  const create=useCreateResource();const update=useUpdateResource();const archive=useDeleteResource();const restore=useRestoreResource();
  const invalidate=()=>{void queryClient.invalidateQueries({queryKey:getListResourcesQueryKey(type,paramsObj)});void queryClient.invalidateQueries({queryKey:getGetDashboardQueryKey()});};
  if(!meta) return <NotFound/>;
  const openCreate=()=>{setEditing(null);setFormData({});setFormOpen(true);};
  const openEdit=(item:Resource)=>{setEditing(item);setFormData(Object.fromEntries(Object.entries(item.data).map(([k,v])=>[k,v==null?'':String(v)])));setFormOpen(true);};
  const save=(e:FormEvent)=>{e.preventDefault();const cleaned=Object.fromEntries(Object.entries(formData).filter(([,v])=>v!=='').map(([k,v])=>[k, v.trim()]));const data:ResourceInput={data:cleaned};if(editing){update.mutate({resourceType:type,id:editing.id,data},{onSuccess:()=>{invalidate();setFormOpen(false);setSelected(null);}});}else{create.mutate({resourceType:type,data},{onSuccess:()=>{invalidate();setFormOpen(false);}});}};
  const toggleSort=(field:string)=>{if(sort===field)setDirection(d=>d==='asc'?'desc':'asc');else{setSort(field);setDirection('asc');}setPage(1);};
  const primarySort=type==='icu-beds'?'bedId':type==='blood'?'bloodGroup':'name';
  const result=list.data;
  const archived=includeArchived;
  return <div className="page-stack">
    <PageHeading eyebrow="RESOURCE INVENTORY" title={meta.title} description={meta.hint} action={<Button kind="primary" onClick={openCreate}><Plus size={17}/> Add {meta.singular.toLowerCase()}</Button>}/>
    <section className="resource-summary-line"><div><span className="small-live-dot"/><b>{result?.total ?? '—'}</b><span>records</span></div><div className="summary-sep"/><span>{archived?'Including archived records':'Active inventory'}</span><button className="inline-toggle" onClick={()=>{setIncludeArchived(a=>!a);setPage(1);}} aria-pressed={includeArchived}>{includeArchived?'Hide archived':'Show archived'}</button></section>
    <section className="panel inventory-panel">
      <div className="inventory-toolbar"><label className="search-box"><Search size={17}/><input aria-label={`Search ${meta.title}`} placeholder={`Search ${meta.title.toLowerCase()}…`} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/><kbd>/</kbd></label><label className="select-wrap"><Filter size={15}/><select aria-label="Filter by status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{['available','in-use','occupied','reserved','maintenance','critical','warning','expired'].map(s=><option key={s} value={s}>{humanize(s)}</option>)}</select></label>{['medicines','blood'].includes(type)&&<label className="select-wrap"><Clock3 size={15}/><select aria-label="Filter by expiry" value={expiry} onChange={e=>{setExpiry(e.target.value as typeof expiry);setPage(1);}}><option value="any">Any expiry</option><option value="soon">Expiring in 30 days</option><option value="expired">Expired</option></select></label>}<button className={`filter-pill ${includeArchived?'selected':''}`} onClick={()=>{setIncludeArchived(x=>!x);setPage(1);}}><ArchiveIcon/> Archived</button></div>
      {list.isLoading?<SkeletonRows/>:list.error?<ErrorState retry={()=>void list.refetch()}/>:!result?.items.length?<EmptyState title={search||status?'No matching records':`No ${meta.title.toLowerCase()} recorded`} copy={search||status?'Try adjusting the search or status filter.':'Add the first record to keep your operational picture current.'} action={!search&&<Button kind="primary" onClick={openCreate}><Plus size={16}/> Add resource</Button>}/>:<>
        <div className="table-scroll"><table className="data-table"><thead><tr><th><button className="sort-button" onClick={()=>toggleSort(primarySort)}>Resource <ArrowUpDown size={13}/></button></th><th>Location / details</th><th>Status</th><th><button className="sort-button" onClick={()=>toggleSort('updatedAt')}>Last updated {sort==='updatedAt'&&direction==='asc'?<ArrowUp size={13}/>:<ArrowDown size={13}/>}</button></th><th className="th-actions">Actions</th></tr></thead><tbody>
        {result.items.map((item)=><tr key={item.id} className={selected?.id===item.id?'row-selected':''} onClick={()=>setSelected(item)}><td><div className="resource-cell"><span className="resource-cell-icon"><meta.icon size={17}/></span><span><b>{itemName(item)}</b><small>{item.id.slice(0,9)}</small></span></div></td><td><div className="details-cell">{displayDetail(item)}</div></td><td><StatusBadge value={String(item.data.status??(item.archivedAt?'archived':'available'))}/></td><td><time className="muted-time">{timeAgo(item.updatedAt)}</time></td><td><div className="table-actions"><button className="icon-btn" aria-label={`Edit ${itemName(item)}`} onClick={(e)=>{e.stopPropagation();openEdit(item);}}><MoreHorizontal size={17}/></button>{item.archivedAt?<Button kind="quiet" className="table-action" onClick={()=>restore.mutate({resourceType:type,id:item.id},{onSuccess:invalidate})}>Restore</Button>:<Button kind="quiet" className="table-action" onClick={()=>{if(window.confirm(`Archive ${itemName(item)}?`)) archive.mutate({resourceType:type,id:item.id},{onSuccess:()=>{invalidate();if(selected?.id===item.id)setSelected(null);}});}}>Archive</Button>}</div></td></tr>)}
        </tbody></table></div>
        <div className="table-footer"><span>Showing {(page-1)*result.limit+1}–{Math.min(page*result.limit,result.total)} of {result.total}</span><div className="pager"><button className="icon-btn" aria-label="Previous page" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/></button><span>Page {page}</span><button className="icon-btn" aria-label="Next page" disabled={page*result.limit>=result.total} onClick={()=>setPage(p=>p+1)}><ChevronRight size={17}/></button></div></div>
      </>}
      {selected&&<div className="detail-drawer"><div className="drawer-head"><div><span className="eyebrow">RESOURCE RECORD</span><h3>{detail.data?itemName(detail.data):itemName(selected)}</h3></div><button className="icon-btn" aria-label="Close details" onClick={()=>setSelected(null)}><X size={18}/></button></div>{detail.isLoading?<div className="skeleton h-24"/>:detail.error?<ErrorState retry={()=>void detail.refetch()}/>:<><div className="detail-grid">{Object.entries(detail.data?.data??selected.data).map(([k,v])=><div key={k}><small>{humanize(k)}</small><b>{String(v)}</b></div>)}<div><small>Updated</small><b>{new Date(selected.updatedAt).toLocaleString()}</b></div></div><div className="drawer-actions"><Button onClick={()=>openEdit(selected)}>Edit record</Button>{selected.archivedAt?<Button kind="primary" onClick={()=>restore.mutate({resourceType:type,id:selected.id},{onSuccess:()=>{invalidate();setSelected(null);}})}>Restore</Button>:<Button kind="danger" onClick={()=>{if(window.confirm(`Archive ${itemName(selected)}?`))archive.mutate({resourceType:type,id:selected.id},{onSuccess:()=>{invalidate();setSelected(null);}});}}>Archive</Button>}</div></>}</div>}
    </section>
    {(create.error||update.error||archive.error||restore.error)&&<div role="alert" className="inline-error">A change could not be saved. Please try again.</div>}
    {formOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setFormOpen(false);}}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="resource-form-title"><div className="modal-head"><div><p className="eyebrow">{editing?'UPDATE INVENTORY':'NEW INVENTORY RECORD'}</p><h2 id="resource-form-title">{editing?'Edit':'Add'} {meta.singular.toLowerCase()}</h2></div><button className="icon-btn" onClick={()=>setFormOpen(false)} aria-label="Close form"><X size={19}/></button></div><form onSubmit={save}><div className="form-fields">{meta.fields.map(f=>{const optional=['patientId','notes','lastServiced'].includes(f.key);return <label className="field" key={f.key}><span>{f.label}</span>{f.options?<select required={!optional} value={formData[f.key]??''} onChange={e=>setFormData({...formData,[f.key]:e.target.value})}><option value="">Select…</option>{f.options.map(o=><option key={o} value={o}>{humanize(o)}</option>)}</select>:<input required={!optional} type={f.type??'text'} value={formData[f.key]??''} onChange={e=>setFormData({...formData,[f.key]:e.target.value})} placeholder={f.label}/>}</label>;})}</div>{(create.error||update.error)&&<p className="form-error" role="alert">Unable to save this record. Review the fields and try again.</p>}<div className="modal-actions"><Button onClick={()=>setFormOpen(false)}>Cancel</Button><Button type="submit" kind="primary" disabled={create.isPending||update.isPending}>{create.isPending||update.isPending?'Saving…':editing?'Save changes':'Create record'}</Button></div></form></section></div>}
  </div>;
}
function ArchiveIcon(){return <ClipboardList size={15}/>;}
function humanize(value:string) { return value.replace(/([A-Z])/g,' $1').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
function itemName(item:Resource) { const data=item.data;return String(data.name??data.bedId??data.bloodGroup??data.assetId??data.medicineName??`${resourceMeta[item.resourceType]?.singular??'Resource'} ${item.id.slice(0,6)}`); }
function displayDetail(item:Resource) { const d=item.data;return String(d.location??d.ward??d.type??(d.quantity!==undefined?`${d.quantity} ${d.unit??'units'}`:d.category??'—')); }
function StatusBadge({value}:{value:string}) { const key=value.toLowerCase();return <span className={`status-badge ${['available','active','in-use','occupied'].includes(key)?'good':['critical','expired','maintenance'].includes(key)?'bad':['warning','reserved'].includes(key)?'warn':'neutral'}`}><i/>{humanize(value)}</span>; }

function AlertsPage() {
  const [unreadOnly,setUnreadOnly]=useState(false);
  const params=useMemo<ListAlertsParams>(()=>({unreadOnly:unreadOnly||undefined}),[unreadOnly]);
  const {data:alerts,isLoading,error,refetch}=useListAlerts(params);
  const mark=useMarkAlertRead();const client=useQueryClient();
  const refresh=()=>{void client.invalidateQueries({queryKey:getListAlertsQueryKey(params)});void client.invalidateQueries({queryKey:getListAlertsQueryKey({})});void client.invalidateQueries({queryKey:getGetDashboardQueryKey()});};
  return <div className="page-stack"><PageHeading eyebrow="OPERATIONAL SIGNALS" title="Alert center" description="Time-sensitive changes across your hospital inventory." action={<label className="switch-control"><input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/><span className="switch-track"/><span>Unread only</span></label>}/>
    <div className="alert-summary"><span className="alert-summary-icon"><Bell size={18}/></span><div><b>{alerts?.filter(a=>!a.isRead).length??'—'} unread</b><small>Review and acknowledge each operational signal.</small></div></div>
    {isLoading?<div className="panel"><SkeletonRows/></div>:error?<ErrorState retry={()=>void refetch()}/>:!alerts?.length?<EmptyState title="You're up to date" copy={unreadOnly?'There are no unread alerts.':'No alerts have been generated for your inventory.'}/>:<div className="alert-list">{alerts.map((alert)=><AlertCard key={alert.id} alert={alert} busy={mark.isPending} onRead={()=>mark.mutate({id:alert.id,data:{isRead:!alert.isRead}},{onSuccess:refresh})}/>)}</div>}
    {mark.error&&<div className="inline-error" role="alert">We couldn't update alert status. Try again.</div>}
  </div>;
}
function AlertCard({alert,busy,onRead}:{alert:Alert;busy:boolean;onRead:()=>void}) { const severity=alert.severity.toLowerCase();return <article className={`alert-card ${alert.isRead?'is-read':''}`}><div className={`alert-severity ${severity}`}>{severity==='critical'||severity==='high'?<AlertTriangle size={18}/>:severity==='warning'?<AlertCircle size={18}/>:<CircleHelp size={18}/>}</div><div className="alert-content"><div className="alert-title-line"><h3>{alert.title}</h3><span className={`severity-tag ${severity}`}>{humanize(alert.severity)}</span>{!alert.isRead&&<span className="unread-dot" aria-label="Unread"/>}</div><p>{alert.message}</p><div className="alert-meta"><span>{humanize(alert.resourceType)}</span><span>·</span><time>{timeAgo(alert.createdAt)}</time><span>·</span><span>{alert.resourceId.slice(0,8)}</span></div></div><button className="alert-read-btn" disabled={busy} onClick={onRead}>{alert.isRead?<><CheckCheck size={15}/> Mark unread</>:<><Check size={15}/> Mark read</>}</button></article>; }

function HistoryPage() {
  const [search,setSearch]=useState('');const [resourceType,setResourceType]=useState('');
  const [page,setPage]=useState(1);
  const params=useMemo<ListHistoryParams>(()=>({q:search||undefined,resourceType:resourceType?resourceType as ResourceType:undefined,page,limit:15}),[search,resourceType,page]);
  const {data,error,isLoading,refetch}=useListHistory(params);
  return <div className="page-stack"><PageHeading eyebrow="ACCOUNTABILITY" title="Audit history" description="A traceable timeline of inventory changes across the hospital."/>
    <section className="panel history-panel"><div className="inventory-toolbar"><label className="search-box"><Search size={17}/><input aria-label="Search audit history" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search actors or resource IDs…"/></label><label className="select-wrap"><Filter size={15}/><select aria-label="Filter resource type" value={resourceType} onChange={e=>{setResourceType(e.target.value);setPage(1);}}><option value="">All resources</option>{resourceTypes.map(t=><option value={t} key={t}>{resourceMeta[t].title}</option>)}</select></label></div>
    {isLoading?<SkeletonRows/>:error?<ErrorState retry={()=>void refetch()}/>:!data?.items.length?<EmptyState title="No changes to show" copy="Audit events matching these filters will appear here."/>:<><div className="timeline">{data.items.map((item)=><div className="timeline-item" key={item.id}><div className={`timeline-marker ${item.action.toLowerCase()}`}/><div className="timeline-content"><div className="timeline-main"><div><b>{item.actorName}</b><span>{actionDescription(item)}</span></div><time>{new Date(item.createdAt).toLocaleString()}</time></div><div className="timeline-detail"><StatusBadge value={item.action}/><span>{resourceMeta[item.resourceType]?.singular??item.resourceType}</span><code>{item.resourceId}</code><Link href={`/resources/${item.resourceType}`} className="text-link">Open inventory <ExternalLink size={13}/></Link></div></div></div>)}</div><div className="table-footer"><span>{data.total} recorded changes</span><div className="pager"><button className="icon-btn" aria-label="Previous page" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={17}/></button><span>Page {page}</span><button className="icon-btn" aria-label="Next page" disabled={page*data.limit>=data.total} onClick={()=>setPage(p=>p+1)}><ChevronRight size={17}/></button></div></div></>}</section>
  </div>;
}
function actionDescription(item:HistoryItem) { return `${item.action.toLowerCase()} ${resourceMeta[item.resourceType]?.singular?.toLowerCase()??'resource'} record`; }

function AiPage() {
  const [focus,setFocus]=useState('');
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const run=useRunAiAnalysis();const actionPlan=useCreateActionPlan();const checklist=useCreateChecklist();
  const {data:history,isLoading:historyLoading,error:historyError,refetch}=useListAiHistory();
  const input=():AnalysisInput=>({focus:focus.trim()||undefined});
  const client=useQueryClient();
  const onResult=(result:Analysis)=>{setAnalysis(result);void client.invalidateQueries({queryKey:getListAiHistoryQueryKey()});};
  const analyze=()=>run.mutate({data:input()},{onSuccess:onResult});
  return <div className="page-stack"><PageHeading eyebrow="DECISION SUPPORT" title="Resource intelligence" description="AI-assisted operational analysis based on your current inventory."/>
    <section className="ai-intro"><div className="ai-orbit"><span/><span/><Sparkles size={24}/></div><div className="ai-intro-copy"><span className="eyebrow">HOSPITAL RESOURCE ANALYSIS</span><h2>See the pressure points before they become problems.</h2><p>Generate a current assessment, uncover critical resources and receive practical next steps. Analysis uses live inventory data.</p><label className="focus-field"><span>Optional area of focus</span><input maxLength={500} value={focus} onChange={e=>setFocus(e.target.value)} placeholder="e.g. Review medicine expiry risk or ICU readiness"/></label><Button kind="primary" onClick={analyze} disabled={run.isPending}><Sparkles size={17}/>{run.isPending?'Analyzing current inventory…':'Run resource analysis'}</Button>{run.error&&<p className="form-error" role="alert">Analysis could not complete. Please retry in a moment.</p>}</div><div className="ai-intro-side"><span>ANALYSIS IS</span><b>Live</b><small>Generated from current hospital resource records</small><i><span/></i><small>Private to your workspace</small></div></section>
    {analysis&&<section className="analysis-result"><div className="analysis-header"><div><p className="eyebrow">LATEST ASSESSMENT · {new Date(analysis.createdAt).toLocaleString()}</p><h2>Operational assessment</h2></div><StatusBadge value={`${analysis.riskLevel} risk`}/></div><p className="analysis-summary">{analysis.summary}</p>
      <div className="analysis-columns"><div><h3><AlertTriangle size={16}/> Critical resources</h3>{analysis.criticalResources.length?analysis.criticalResources.map((r,i)=><div className="critical-resource" key={`${r.resourceType}-${i}`}><b>{humanize(r.resourceType)}</b><span>{r.reason}</span></div>):<p className="subtle-copy">No critical resources identified in this assessment.</p>}</div><div><h3><Zap size={16}/> Recommended actions</h3>{analysis.recommendedActions.length?analysis.recommendedActions.map((a,i)=><div className="recommendation" key={`${a.action}-${i}`}><span className={`priority-dot ${a.priority.toLowerCase()}`}/><div><b>{a.action}</b><small>{a.reason}</small></div><span className="priority-label">{a.priority}</span></div>):<p className="subtle-copy">No actions were returned.</p>}</div></div>
      <div className="analysis-actions"><Button kind="primary" disabled={actionPlan.isPending} onClick={()=>actionPlan.mutate({data:input()},{onSuccess:onResult})}><ClipboardList size={16}/>{actionPlan.isPending?'Creating…':'Create action plan'}</Button><Button disabled={checklist.isPending} onClick={()=>checklist.mutate({data:input()},{onSuccess:onResult})}><CheckCheck size={16}/>{checklist.isPending?'Creating…':'Generate checklist'}</Button></div>{(actionPlan.error||checklist.error)&&<p className="form-error" role="alert">Unable to create this follow-up. Please try again.</p>}
      {analysis.checklist.length>0&&<div className="checklist-result"><h3>Operational checklist</h3>{analysis.checklist.map((item,i)=><label key={`${item.task}-${i}`} className="checklist-row"><input type="checkbox" checked={item.completed} onChange={()=>setAnalysis(current=>current?{...current,checklist:current.checklist.map((entry,index)=>index===i?{...entry,completed:!entry.completed}:entry)}:current)}/><span>{item.task}</span><span className={`priority-label ${item.priority.toLowerCase()}`}>{item.priority}</span></label>)}</div>}
    </section>}
    <section className="panel ai-history"><div className="section-heading compact"><div><p className="eyebrow">PREVIOUS RUNS</p><h2>Analysis history</h2></div></div>{historyLoading?<SkeletonRows/>:historyError?<ErrorState retry={()=>void refetch()}/>:!history?.length?<EmptyState title="No previous analyses" copy="Completed analyses will be available here for reference."/>:<div className="analysis-history-list">{history.map(item=><button key={item.id} className="analysis-history-item" onClick={()=>setAnalysis(item)}><span className="history-spark"><Sparkles size={16}/></span><span><b>{item.summary.slice(0,125)}{item.summary.length>125?'…':''}</b><small>{new Date(item.createdAt).toLocaleString()}</small></span><StatusBadge value={`${item.riskLevel} risk`}/><ChevronRight size={16}/></button>)}</div>}</section>
  </div>;
}

function AuthPage({mode}:{mode:'login'|'register'}) {
  const isRegister=mode==='register';
  const [,setLocation]=useLocation();
  const login=useLogin();const register=useRegister();
  const [values,setValues]=useState({name:'',email:'',password:'',hospitalName:''});
  const update=(key:keyof typeof values,value:string)=>setValues(v=>({...v,[key]:value}));
  const submit=(e:FormEvent)=>{e.preventDefault();if(isRegister){register.mutate({data:{name:values.name,email:values.email,password:values.password,hospitalName:values.hospitalName}},{onSuccess:()=>{void queryClient.invalidateQueries({queryKey:getGetCurrentUserQueryKey()});setLocation('/');}});}else{login.mutate({data:{email:values.email,password:values.password}},{onSuccess:()=>{void queryClient.invalidateQueries({queryKey:getGetCurrentUserQueryKey()});setLocation('/');}});}};
  const pending=isRegister?register.isPending:login.isPending;const error=isRegister?register.error:login.error;
  return <main className="auth-page"><div className="auth-side"><Link href="/" className="brand auth-brand"><span className="brand-mark"><HeartPulse size={21}/></span><span><b>Wardwell</b><small>OPERATIONS</small></span></Link><div className="auth-message"><div className="auth-emblem"><HeartPulse size={31}/></div><p className="eyebrow">CLEARER OPERATIONS. BETTER CARE.</p><h1>When every resource matters, clarity matters more.</h1><p>A calm, reliable view of hospital capacity, supplies and the decisions that keep care moving.</p></div><div className="auth-side-footer"><span><ShieldCheck size={15}/> Secure hospital workspace</span><span>Built for clinical operations teams</span></div></div><section className="auth-form-side"><div className="auth-form-wrap"><div className="auth-mobile-brand"><span className="brand-mark"><HeartPulse size={19}/></span><b>Wardwell</b></div><p className="eyebrow">{isRegister?'WORKSPACE SETUP':'WELCOME BACK'}</p><h2>{isRegister?'Create your account':'Sign in to your workspace'}</h2><p className="auth-lede">{isRegister?'Set up a secure command center for your hospital.':'Continue to your hospital operations command center.'}</p><form className="auth-form" onSubmit={submit}>{isRegister&&<><label className="field"><span>Full name</span><input required minLength={2} maxLength={100} value={values.name} onChange={e=>update('name',e.target.value)} autoComplete="name" placeholder="Your name"/></label><label className="field"><span>Hospital name</span><input required minLength={2} maxLength={160} value={values.hospitalName} onChange={e=>update('hospitalName',e.target.value)} placeholder="Hospital or health system"/></label></>}<label className="field"><span>Work email</span><input required type="email" value={values.email} onChange={e=>update('email',e.target.value)} autoComplete="email" placeholder="name@hospital.org"/></label><label className="field"><span>Password</span><input required minLength={isRegister?10:1} maxLength={128} type="password" value={values.password} onChange={e=>update('password',e.target.value)} autoComplete={isRegister?'new-password':'current-password'} placeholder={isRegister?'At least 10 characters':'Enter your password'}/></label>{error&&<p className="form-error" role="alert">{isRegister?'Account setup failed. Check your details and try again.':'We could not sign you in. Check your email and password.'}</p>}<Button type="submit" kind="primary" disabled={pending} className="auth-submit">{pending?(isRegister?'Creating account…':'Signing in…'):(isRegister?'Create hospital account':'Sign in')}<ChevronRight size={17}/></Button></form><p className="auth-switch">{isRegister?'Already have an account?':'New to Wardwell?'} <Link href={isRegister?'/login':'/register'}>{isRegister?'Sign in':'Create an account'}</Link></p><p className="auth-footnote"><ShieldCheck size={14}/> Access is limited to authorized hospital team members.</p></div></section></main>;
}

function ProfilePage() {
  const profile=useGetProfile();
  const update=useUpdateProfile();const password=useChangePassword();
  const [details,setDetails]=useState<ProfileUpdate|null>(null);
  const [passwordForm,setPasswordForm]=useState({currentPassword:'',newPassword:''});
  const client=useQueryClient();
  const user=profile.data;
  const submitProfile=(e:FormEvent)=>{e.preventDefault();if(!details)return;update.mutate({data:details},{onSuccess:(updated:User)=>{setDetails({name:updated.name,hospitalName:updated.hospitalName,phone:updated.phone??''});void client.invalidateQueries({queryKey:getGetProfileQueryKey()});void client.invalidateQueries({queryKey:getGetCurrentUserQueryKey()});}});};
  const submitPassword=(e:FormEvent)=>{e.preventDefault();password.mutate({data:passwordForm},{onSuccess:()=>setPasswordForm({currentPassword:'',newPassword:''})});};
  if(profile.isLoading)return <div className="page-stack"><div className="skeleton h-24"/><div className="skeleton h-80"/></div>;
  if(profile.error||!user)return <ErrorState message="Your profile could not be loaded." retry={()=>void profile.refetch()}/>;
  const profileValues=details??{name:user.name,hospitalName:user.hospitalName,phone:user.phone??''};
  return <div className="page-stack"><PageHeading eyebrow="ACCOUNT" title="My profile" description="Manage your identity and secure account access."/>
    <section className="panel profile-card"><div className="profile-banner"><div className="profile-avatar">{user.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div><div><h2>{user.name}</h2><p>{user.email}</p></div><span className="profile-role">{roleName(user.role)}</span></div>
      <form className="settings-form" onSubmit={submitProfile}><div className="form-section-title"><div><h3>Profile information</h3><p>Changes apply to your hospital workspace identity.</p></div><span className="form-section-icon"><Settings2 size={17}/></span></div><div className="form-grid"><label className="field"><span>Full name</span><input required minLength={2} maxLength={100} value={profileValues.name??''} onChange={e=>setDetails({...profileValues,name:e.target.value})}/></label><label className="field"><span>Hospital</span><input required minLength={2} maxLength={160} value={profileValues.hospitalName??''} onChange={e=>setDetails({...profileValues,hospitalName:e.target.value})}/></label><label className="field"><span>Phone number</span><input maxLength={40} type="tel" value={profileValues.phone??''} onChange={e=>setDetails({...profileValues,phone:e.target.value})} placeholder="Optional"/></label><label className="field"><span>Email address</span><input value={user.email} readOnly disabled/><small>Email is managed by your account administrator.</small></label></div>{update.error&&<p className="form-error" role="alert">Profile update failed. Please try again.</p>}<div className="form-bottom"><span className="saved-note">{update.isSuccess&&<><Check size={14}/> Profile saved</>}</span><Button type="submit" kind="primary" disabled={update.isPending}>{update.isPending?'Saving…':'Save profile'}</Button></div></form>
    </section>
    <section className="panel password-panel"><div className="form-section-title"><div><h3>Password & security</h3><p>Use a strong password you do not use elsewhere.</p></div><span className="form-section-icon teal"><ShieldCheck size={18}/></span></div><form onSubmit={submitPassword} className="password-form"><label className="field"><span>Current password</span><input required type="password" value={passwordForm.currentPassword} onChange={e=>setPasswordForm({...passwordForm,currentPassword:e.target.value})} autoComplete="current-password"/></label><label className="field"><span>New password</span><input required minLength={10} maxLength={128} type="password" value={passwordForm.newPassword} onChange={e=>setPasswordForm({...passwordForm,newPassword:e.target.value})} autoComplete="new-password"/><small>At least 10 characters.</small></label>{password.error&&<p className="form-error" role="alert">Password could not be changed. Check your current password.</p>}<div className="form-bottom"><span className="saved-note">{password.isSuccess&&<><Check size={14}/> Password changed</>}</span><Button type="submit" disabled={password.isPending}>{password.isPending?'Updating…':'Update password'}</Button></div></form></section>
  </div>;
}

function SettingsPage({dark,onToggleTheme}:{dark:boolean;onToggleTheme:()=>void}) {
  const [dense,setDense]=useState(()=>localStorage.getItem('hrm-density')==='compact');
  const [notice,setNotice]=useState('');
  useEffect(()=>{document.documentElement.classList.toggle('compact-mode',dense);},[dense]);
  const toggleDensity=()=>{const next=!dense;setDense(next);localStorage.setItem('hrm-density',next?'compact':'comfortable');document.documentElement.classList.toggle('compact-mode',next);setNotice('Display preference saved');window.setTimeout(()=>setNotice(''),2400);};
  return <div className="page-stack"><PageHeading eyebrow="PREFERENCES" title="Preferences" description="Tune your command center to fit the way your team works."/>
    <section className="panel preference-panel"><div className="form-section-title"><div><h3>Display</h3><p>Choose a comfortable presentation for your shift.</p></div><span className="form-section-icon"><Sun size={18}/></span></div><PreferenceRow icon={dark?<Moon size={18}/>:<Sun size={18}/>} title="Appearance" description={dark?'Dark mode is active.':'Light mode is active.'}><button className="preference-action" onClick={onToggleTheme}>{dark?'Switch to light':'Switch to dark'}</button></PreferenceRow><PreferenceRow icon={<LayoutDashboard size={18}/>} title="Information density" description={dense?'Compact tables and tighter spacing.':'Comfortable spacing with more room to scan.'}><button className={`switch-control ${dense?'on':''}`} onClick={toggleDensity} aria-pressed={dense}><span className="switch-track"/><span>{dense?'Compact':'Comfortable'}</span></button></PreferenceRow>{notice&&<p role="status" className="saved-message"><Check size={14}/>{notice}</p>}</section>
    <section className="panel preference-panel"><div className="form-section-title"><div><h3>Workspace</h3><p>Operational information and access details.</p></div><span className="form-section-icon teal"><ShieldCheck size={18}/></span></div><PreferenceRow icon={<Bell size={18}/>} title="Alerts" description="View, filter and acknowledge inventory alerts."><Link href="/alerts" className="preference-action">Open alert center <ChevronRight size={15}/></Link></PreferenceRow><PreferenceRow icon={<FileClock size={18}/>} title="Audit history" description="Review a traceable record of operational changes."><Link href="/history" className="preference-action">View history <ChevronRight size={15}/></Link></PreferenceRow><PreferenceRow icon={<Sparkles size={18}/>} title="Resource intelligence" description="Run an analysis of current resource risk."><Link href="/ai" className="preference-action">Open intelligence <ChevronRight size={15}/></Link></PreferenceRow></section>
  </div>;
}
function PreferenceRow({icon,title,description,children}:{icon:ReactNode;title:string;description:string;children:ReactNode}) { return <div className="preference-row"><span className="preference-icon">{icon}</span><div className="preference-copy"><b>{title}</b><small>{description}</small></div>{children}</div>; }

export default App;
