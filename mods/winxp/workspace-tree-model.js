// Portable, pure grouping model. Space IDs stay unchanged and machine scoped.
export function matches(pattern, path) {
  if (!path) return false;
  return String(pattern || '').split(',').some(raw => {
    const p = raw.trim().replace(/\/+$/, '');
    if (!p) return false;
    const body = p.replace(/^~/, '\u0000').split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*').replace('\u0000', '(?:/home/[^/]+|/Users/[^/]+|/root)');
    return new RegExp((/^[/~]/.test(p) ? '^' : '(?:^|/)') + body + '(?:/|$)').test(path);
  });
}
export function tree(spaces, data = {}, panes = [], hierarchy = {}) {
  const machines = [...new Set(spaces.map(s => s.machine ?? ''))];
  return machines.map(machine => {
    const cfg = data[machine] ?? {list: [], of: {}};
    const parents = hierarchy[machine]?.parents ?? {};
    const local = id => machine && id.startsWith(machine + '/') ? id.slice(machine.length+1) : id;
    const groups = (cfg.list ?? []).map(f => ({...f, kind:'folder', key:`folder:${machine}:${f.id}`, children:[]}));
    const loose = [], source=spaces.filter(s => (s.machine ?? '') === machine);
    const nodes=new Map(source.map(s => [local(s.id), {...s, kind:'space', key:`space:${s.id}`, children:(s.tabs ?? []).map(t => ({...t,kind:'tab',key:`tab:${t.id}`,space:s.id,active:s.active&&t.active,children:[]}))}]));
    function validParent(id) {
      const parent=parents[id];
      if(!parent || parent===id || !nodes.has(parent))return null;
      const seen=new Set([id]);let cursor=parent;
      while(cursor && nodes.has(cursor)) {if(seen.has(cursor))return null;seen.add(cursor);cursor=parents[cursor];}
      return parent;
    }
    for(const s of source) {
      const id=local(s.id), node=nodes.get(id), parent=validParent(id);
      if(parent){nodes.get(parent).children.push(node);continue;}
      const explicit=(cfg.of ?? {})[id], tabs=new Set((s.tabs ?? []).map(t=>t.id));
      const cwd=panes.find(p=>tabs.has(p.tab)&&p.cwd)?.cwd || s.folder;
      const group=explicit!==undefined ? groups.find(g=>g.id===explicit) : groups.filter(g=>matches(g.match,cwd)).sort((a,b)=>String(b.match).length-String(a.match).length)[0];
      (group?.children ?? loose).push(node);
    }
    return {kind:'machine',key:`machine:${machine}`,name:machine || 'This computer',children:[...groups,...loose]};
  });
}
export function pathFor(nodes, spaceId, trail = []) {
  for (const node of nodes) {
    const path = [...trail, node.name];
    if (node.kind === 'space' && node.id === spaceId) return path;
    const found = pathFor(node.children ?? [], spaceId, path);
    if (found) return found;
  }
  return null;
}
