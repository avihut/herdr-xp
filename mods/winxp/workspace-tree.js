import {View, div} from 'gpui-kit';
import {h_flex, v_flex} from 'gpui-base';
import {spaces, panes, machines, shared, setShared, props, theme, settings, home, readTextFile, exec, openOverlay, closeOverlay, run} from 'herdr';
import {tree, pathFor} from './workspace-tree-model.js';
// Native chrome families: theme colors are live; only legacy themes with fixed chrome override them.
function skin(t) {
 const name=shared('layout'), dark=settings().dark;
 const s={...t, radius:5, borderWidth:1, font:null, title:'Workspaces', mark:'▤', header:t.chrome, headerText:t.foreground};
 if(['my-terminals','terminals'].includes(name))Object.assign(s,{radius:14,chrome:'#1d1f22',popover:'#1d1f22',foreground:'#e8e9eb',border:'#383b40',hover:'#34373c',selected:'#34373c',header:'#252628',headerText:'#e8e9eb'});
 if(name==='lcars')Object.assign(s,{radius:14,font:'Antonio',title:'WORKSPACE DIRECTORY',mark:'▰',chrome:'#000000',popover:'#000000',foreground:'#ffcc99',accent:'#ff9900',border:'#cc99cc',hover:'#292238',selected:'#392a24',header:'#ff9900',headerText:'#000000'});
 if(['win98','win98-dark'].includes(name))Object.assign(s,{radius:0,font:'Pixelated MS Sans Serif',title:'Workspace Explorer',mark:'▣',bevel:true,header:dark?'#172651':'#000080',headerText:'#ffffff'});
 if(name==='winxp')Object.assign(s,{radius:3,font:'Tahoma',title:'Workspace Explorer',mark:'▣',bevel:true,header:dark?'#253d63':'#245edb',headerText:'#ffffff'});
 if(name==='pasture')Object.assign(s,{radius:4,borderWidth:2,title:'FIELDS & FOLDERS',mark:'▥',chrome:dark?'#5a3d24':'#ab7748',popover:dark?'#6b4a2c':'#d2a673',foreground:dark?'#efe4cc':'#573c27',border:dark?'#3a2716':'#9b6b40',hover:dark?'#7d5a37':'#e0bb8c',selected:dark?'#7d5a37':'#e0bb8c',header:dark?'#4f3721':'#ab7748',headerText:dark?'#f3e4c6':'#fff4d9'});
 if(name==='fallout')Object.assign(s,{radius:0,borderWidth:2,font:'Geist Mono',title:'DATA / SETTLEMENTS',mark:'▣',header:t.selected,headerText:t.accent});
 if(name==='evangelion')Object.assign(s,{radius:0,borderWidth:2,font:'Geist Mono',title:'NERV / DEPLOYMENT TREE',mark:'◆',header:t.accent,headerText:t.accent_foreground});
 if(name==='tron')Object.assign(s,{radius:2,title:'GRID / SECTOR TREE',mark:'◇',header:t.chrome,headerText:t.accent});
 if(name==='expanse')Object.assign(s,{radius:2,font:'Geist Mono',title:'ROCI / FLIGHT DIRECTORY',mark:'▰',header:t.selected,headerText:t.accent});
 if(name==='starcraft2')Object.assign(s,{radius:2,title:'COMMAND / OPERATIONS',mark:'◆',header:t.raised,headerText:t.accent});
 if(name==='board')Object.assign(s,{radius:7,title:'Workspace board',mark:'▥'});
 return s;
}
export class WorkspaceTree extends View {
  init(p, cx) {
    this.options = {...(p ?? {}), ...(props() ?? {})};
    this.loading = false;
    this.error = '';
    this.load(cx);
    cx.timer.every(15000, (cx) => this.load(cx));
  }
  load(cx) {
    if(this.loading) return;
    this.loading = true;
    cx.spawn(async cx => {
      try {
        const targets = [...new Set(['', ...spaces().map(s => s.machine ?? '')])];
        for(const machine of targets) {
          try {
            let treeText;
            if(!machine) treeText=await readTextFile(home()+'/.config/herdr-space-tree.json');
            else {const r=await exec('sh',['-c','cat ~/.config/herdr-space-tree.json'],{on:machine});if(r.code===0)treeText=r.stdout;}
            if(treeText){const next=JSON.parse(treeText);if(next.parents && typeof next.parents==='object') {const current=shared('space-hierarchy')??{};if(!current[machine] || (next.at??0)>(current[machine].at??0))setShared('space-hierarchy',{...current,[machine]:next});}}
            let text;
            if(!machine) text = await readTextFile(home()+'/.config/herdr-space-folders.json');
            else {const r = await exec('sh', ['-c', 'cat ~/.config/herdr-space-folders.json'], {on:machine}); if(r.code !== 0) continue; text=r.stdout;}
            if(!text) continue;
            const data=JSON.parse(text);
            if(!Array.isArray(data.list) || !data.of || typeof data.of !== 'object') throw Error('Invalid workspace groups');
            const current=shared('space-folders') ?? {}, previous=current[machine];
            if(!previous || (data.at ?? 0) > (previous.at ?? 0)) setShared('space-folders', {...current, [machine]:data});
          } catch(e) {if(!machine) this.error='Workspace groups could not be loaded';}
        }
      } finally {this.loading=false; cx.notify();}
    });
  }
  open() {
    openOverlay({mod:this.options.owner ?? 'workspace-tree', props:{role:'workspace-tree', treeMenu:true, owner:this.options.owner ?? 'workspace-tree'}, kind:'popup', width:360, height:440, at:'pointer'});
  }
  render() {
    const t=skin(theme()), list=spaces(), nodes=tree(list, shared('space-folders') ?? {}, panes(), shared('space-hierarchy') ?? {});
    const selected=list.find(s=>s.active), path=selected && pathFor(nodes, selected.id);
    const folded=shared('workspace-tree.folded') ?? {};
    const toggle=(node,cx)=> {setShared('workspace-tree.folded', {...(shared('workspace-tree.folded') ?? {}), [node.key]:!isFolded(node)});cx.notify();};
    const isFolded=node => folded[node.key] ?? (node.kind==='space' && !node.active && !node.children.some(c=>c.kind==='space'));
    if(!this.options.treeMenu && !this.options.inline) return h_flex().size_full().min_w(0).px(6).gap(4).items_center().bg(t.chrome).text_color(t.foreground).text_size(12).when(!!t.font,e=>e.font_family(t.font))
      .child(div().id('workspace-tree-open').flex_1().min_w(0).h(24).px(7).rounded(t.radius).border(t.borderWidth).border_color(t.border).when(!!t.bevel,e=>e.border_t(1).border_l(1).border_color(t.muted)).flex().items_center().gap(5).cursor_pointer().hover(e=>e.bg(t.hover))
        .on_mouse_down('left',(_e,cx)=>cx.stop_propagation()).on_click(()=>this.open()).tooltip('Workspace hierarchy · '+(path?.join(' › ') ?? 'All workspaces'))
        .child(t.mark).child(div().flex_1().min_w(0).truncate().child(path?.slice(1).join(' › ') || 'Workspaces')).child('▾'));
    const rows=[];
    const visit=(node,depth)=> {
      const childSpaces=node.children.filter(c=>c.kind!=='tab'), branch=childSpaces.length>0, fold=isFolded(node);
      const select=()=>{if(node.kind==='space')run('space.select',{id:node.id});else if(node.kind==='tab'){run('space.select',{id:node.space});run('tab.select',{id:node.id});}else return;if(props()?.overlay)closeOverlay(props()?.overlay);};
      rows.push(h_flex().id('tree-'+node.key).h(29).flex_none().pl(6+depth*16).pr(8).gap(5).items_center().rounded(t.radius).when(!!node.active,e=>e.bg(t.selected)).text_color(node.active?t.accent:t.foreground)
        .child(div().id('fold-'+node.key).w(16).cursor_pointer().child(branch?(fold?'▸':'▾'):'·').on_click((_e,cx)=>{if(branch)toggle(node,cx);}))
        .child(div().id('select-'+node.key).flex_1().min_w(0).truncate().cursor_pointer().child(node.name).tooltip(node.name).on_click((_e,cx)=>branch && node.kind!=='space'?toggle(node,cx):select()))
        .when(!!node.status,e=>e.child(div().size(5).rounded_full().bg(t[node.status] ?? t.muted)))
        .when(node.kind==='folder',e=>e.child(div().text_color(t.muted).child(String(node.children.length)))));
      if(branch&&!fold) for(const child of childSpaces)visit(child,depth+1);
    };
    for(const node of nodes) {if(nodes.length===1 && node.name==='This computer')for(const child of node.children)visit(child,0);else visit(node,0);}
    return v_flex().w_full().when(!!this.options.inline,e=>e.h_full()).when(!this.options.inline,e=>e.h(440)).min_h(0).p(7).gap(4).bg(t.popover).text_color(t.foreground).text_size(12).rounded(t.radius).border(t.borderWidth).border_color(t.border).when(!!t.font,e=>e.font_family(t.font))
      .child(h_flex().items_center().justify_between().px(6).py(5).bg(t.header).text_color(t.headerText).child(div().font_semibold().child(t.title)).when(!!props()?.overlay,e=>e.child(div().id('close-tree').px(5).cursor_pointer().child('×').on_click(()=>closeOverlay(props()?.overlay)))))
      .child(v_flex().id('workspace-tree-scroll').flex_1().min_h(0).overflow_y_scrollbar().children(rows).when(!rows.length,e=>e.child(div().p(10).child('No workspaces yet.'))))
      .when(!!this.error,e=>e.child(div().text_color(t.muted).child(this.error)));
  }
}

// Data and loading are shared; each layout retains its own PRIMARY spaces UI.
export function initSpaceHierarchy(cx) { const reader=new WorkspaceTree(); reader.init({inline:true},cx); return reader; }
export function primaryForest(list=spaces()) {
 const clean=n=>({...n,children:n.children.filter(c=>c.kind==='space').map(clean)});
 return tree(list,{},[],shared('space-hierarchy')??{}).flatMap(m=>m.children.filter(n=>n.kind==='space').map(clean));
}
export function primaryRows(list=spaces()) {
 const out=[],folded=shared('workspace-tree.folded')??{};
 const visit=(s,depth,parentId)=>{const expanded=!folded[s.key];out.push({...s,nesting:{depth,parentId,childCount:s.children.length,expanded}});if(expanded)s.children.forEach(c=>visit(c,depth+1,s.id));};
 primaryForest(list).forEach(s=>visit(s,0,null));return out;
}
export function toggleSpaceChildren(s) {
 const key=typeof s==='string'?'space:'+s:s.key;
 const folded=shared('workspace-tree.folded')??{};setShared('workspace-tree.folded',{...folded,[key]:!folded[key]});
}
export function nestedSpaceRow(s,element,o={}) {
 const n=s.nesting??{depth:0,childCount:0,expanded:true};
 return h_flex().id('nested-'+s.id).w_full().min_w(0).flex_none().pl(n.depth*(o.indent??16)).gap(o.gap??3).items_center()
  .child(div().id('children-'+s.id).w(o.width??18).flex_none().text_size(o.size??12).text_color(o.color??theme().muted)
   .when(!!n.childCount,e=>e.cursor_pointer().tooltip((n.expanded?'Collapse':'Expand')+' child spaces').on_mouse_down('left',(_e,cx)=>cx.stop_propagation()).on_click((_e,cx)=>{cx.stop_propagation();toggleSpaceChildren(s);cx.notify();}))
   .child(n.childCount?(n.expanded?(o.open??'▾'):(o.closed??'▸')):(n.depth?(o.leaf??'└'):' ')))
  .child(element.flex_1().min_w(0));
}
