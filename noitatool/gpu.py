"""OpenCL prefilter. All emitted candidates are verified by the upstream engine."""
from pathlib import Path
import json
from .paths import DATA,STATE

LIQUIDS = 'acid alcohol blood blood_fungi blood_worm cement lava magic_liquid_berserk magic_liquid_charm magic_liquid_faster_levitation magic_liquid_faster_levitation_and_movement magic_liquid_invisibility magic_liquid_mana_regeneration magic_liquid_movement_faster magic_liquid_protection_all magic_liquid_teleportation magic_liquid_unstable_polymorph magic_liquid_unstable_teleportation magic_liquid_worm_attractor material_confusion mud oil poison radioactive_liquid swamp urine water water_ice water_swamp magic_liquid_random_polymorph'.split()
SOLIDS = 'bone brass coal copper diamond fungi gold grass gunpowder gunpowder_explosive rotten_meat sand silver slime snow soil wax honey'.split()
MATERIALS = LIQUIDS + SOLIDS + ['water_salt','magic_liquid_polymorph','gunpowder_unstable']
SPELLS = ['LIGHT_BULLET','SPITTER','RUBBER_BALL','BOUNCY_ORB']
BOMBS = ['BOMB','DYNAMITE','MINE','ROCKET','GRENADE']
PERK_DATA = list(json.loads((DATA/'obj/perks.json').read_text(encoding='utf-8')).values())
PERKS = [p['id'] for p in PERK_DATA]

def perk_source():
    arrays={
        'perk_enabled':[int(not p.get('not_in_default_perk_pool',False)) for p in PERK_DATA],
        'perk_stackable':[int(bool(p.get('stackable'))) for p in PERK_DATA],
        'perk_max_pool':[p.get('max_in_perk_pool',0) for p in PERK_DATA],
        'perk_rare':[int(bool(p.get('stackable_is_rare'))) for p in PERK_DATA],
        'perk_distance':[(p.get('stackable_how_often_reappears') or 4) if p.get('stackable') else -1 for p in PERK_DATA],
    }
    source='\n'.join('__constant int '+key+'['+str(len(PERKS))+']={'+','.join(map(str,values))+'};' for key,values in arrays.items())
    source+='''
int make_deck(uint ws,__private int *deck){
    double s=pos_seed(ws,1,2);int count=0;
    for(int p=0;p<PERK_COUNT;p++){
        if(!perk_enabled[p])continue;
        int n=1;
        if(perk_stackable[p]){
            int maximum=rnd(&s,1,2);
            if(perk_max_pool[p])maximum=rnd(&s,1,perk_max_pool[p]);
            if(perk_rare[p])maximum=1;
            n=rnd(&s,1,maximum);
        }
        for(int j=0;j<n;j++)deck[count++]=p;
    }
    for(int i=count-1;i>=1;i--){int j=rnd(&s,0,i);int temp=deck[i];deck[i]=deck[j];deck[j]=temp;}
    for(int i=count-1;i>=0;i--){
        int distance=perk_distance[deck[i]];
        if(distance==-1)continue;
        int remove=0;
        for(int j=max(0,i-distance);j<i;j++)if(deck[j]==deck[i]){remove=1;break;}
        if(remove){for(int j=i;j<count-1;j++)deck[j]=deck[j+1];count--;}
    }
    return count;
}
int has_perk(__private int *deck,int count,int id,int low,int high){
    for(int i=low;i<min(high,count);i++)if(deck[i]==id)return 1;
    return 0;
}
__kernel void diagnostic_perks(uint start,__global int *out){
    uint i=get_global_id(0);int deck[128];int count=make_deck(start+i,deck);
    out[i*129]=count;
    for(int j=0;j<128;j++)out[i*129+1+j]=j<count?deck[j]:-1;
}
'''.replace('PERK_COUNT',str(len(PERKS)))
    return source

def devices():
    try:
        import pyopencl as cl
        return [d for p in cl.get_platforms() for d in p.get_devices(device_type=cl.device_type.GPU) if d.double_fp_config]
    except Exception:
        return []

def expression(rule):
    if rule['type']=='advanced':return expression(rule['val'])
    """Return an exact supported expression, or None for unsupported subtrees."""
    kind = rule['type']
    if kind=='perkSet':
        if rule['val'].get('lottery'):return None
        v=rule['val'];rows=range(7) if v['where']=='any' else [v['where']]
        if v['where']=='deck':
            terms=[f'has_perk(deck,deck_count,{PERKS.index(k)},0,128)' if k in PERKS else '0' for k in v['ids']]
            return '('+(' && ' if v['mode']=='all' else ' || ').join(terms)+')'
        terms=[expression({'type':'perk','val':{('all' if v['mode']=='all' else 'some'):[[]]*row+[v['ids']]}}) for row in rows]
        return '('+' || '.join(terms)+')'
    if kind in ('and','or','not'):
        children = [expression(r) for r in rule['rules']]
        if any(c is None for c in children):
            return None
        if kind == 'not':
            return '!(' + children[0] + ')'
        return '(' + (' && ' if kind == 'and' else ' || ').join(children) + ')'
    if kind in ('startingFlask','startingSpell','startingBombSpell'):
        values, function = {'startingFlask':(MATERIALS,'flask'), 'startingSpell':(SPELLS,'start_spell'), 'startingBombSpell':(BOMBS,'start_bomb')}[kind]
        if not rule.get('val'):
            return '1'
        return f'({function}(ws)=={values.index(rule["val"])})' if rule['val'] in values else '0'
    if kind == 'alchemy':
        parts=[]
        for name, offset in [('LC',0),('AP',3)]:
            values=rule['val'].get(name,[])
            if values:
                ids=[MATERIALS.index(v) for v in values if v in MATERIALS]
                for i in range(offset,offset+3):
                    parts.append('('+' || '.join(f'r[{i}]=={v}' for v in ids)+')' if ids else '0')
        return '('+' && '.join(parts)+')' if parts else '1'
    if kind == 'perk':
        value=rule.get('val',{})
        parts=[]
        def contains(key,low,high):
            return f'has_perk(deck,deck_count,{PERKS.index(key)},{low},{high})' if key in PERKS else '0'
        decks=value.get('deck',[])
        if decks and decks[0]:
            parts.extend(contains(key,0,128) for key in decks[0])
        for mode in ('all','some'):
            for row,values in enumerate(value.get(mode,[])[:7]):
                if values:
                    terms=[contains(key,row*3,row*3+3) for key in values]
                    parts.append('('+(' && ' if mode=='all' else ' || ').join(terms)+')')
        return '('+' && '.join(parts)+')' if parts else '1'
    return None

def prefilter(rule):
    if rule['type']=='advanced':return prefilter(rule['val'])
    if rule['type']=='perkSet' and rule['val'].get('lottery'):
        # Presence is necessary, but the position-dependent lottery must be verified on CPU.
        return expression(dict(rule,val={k:v for k,v in rule['val'].items() if k!='lottery'}))
    exact = expression(rule)
    if exact is not None:
        return exact
    if rule['type'] == 'and':
        parts=[prefilter(r) for r in rule['rules']]
        parts=[p for p in parts if p is not None]
        if parts:
            return '('+' && '.join(parts)+')'
    return None

class GPU:
    def __init__(self, rule, device_index=0):
        import pyopencl as cl
        import numpy as np
        self.cl, self.np = cl, np
        found=devices()
        if not found:
            raise RuntimeError('没有支持 FP64 的 OpenCL GPU，请安装显卡驱动及 pyopencl')
        expr=prefilter(rule)
        if expr is None or expr == '1':
            raise ValueError('当前条件没有可加速的预筛选项。请在 AND 条件中添加天赋、初始配置或炼金配方。')
        self.device=found[device_index]
        self.context=cl.Context([self.device])
        self.queue=cl.CommandQueue(self.context)
        source=Path(__file__).with_name('kernels.cl').read_text()
        source+='\n'+perk_source()
        init='int r[6];recipes(ws,r);' if 'r[' in expr else ''
        if 'has_perk' in expr:init+='int deck[128];int deck_count=make_deck(ws,deck);'
        source+='\n__kernel void search(uint start,__global uchar *out){uint i=get_global_id(0),ws=start+i;'+init+'out[i]=(uchar)('+expr+');}\n'
        source+='\n__kernel void search_list(__global const uint *seeds,__global uchar *out){uint i=get_global_id(0),ws=seeds[i];'+init+'out[i]=(uchar)('+expr+');}\n'
        cache=STATE/'.cache/opencl';cache.mkdir(parents=True,exist_ok=True)
        self.program=cl.Program(self.context,source).build(options=['-cl-std=CL1.2'],cache_dir=str(cache))
        self.kernel=cl.Kernel(self.program,'search')

    def candidates(self, start, end):
        np,cl=self.np,self.cl
        out=np.empty(end-start,dtype=np.uint8)
        buffer=cl.Buffer(self.context,cl.mem_flags.WRITE_ONLY,out.nbytes)
        try:
            self.kernel(self.queue,(len(out),),None,np.uint32(start),buffer)
            cl.enqueue_copy(self.queue,out,buffer).wait()
            return (np.flatnonzero(out)+start).tolist()
        finally:
            buffer.release()

    def candidate_seeds(self,seeds):
        np,cl=self.np,self.cl
        values=np.asarray(seeds,dtype=np.uint32)
        if not len(values):return []
        out=np.empty(len(values),dtype=np.uint8)
        source=cl.Buffer(self.context,cl.mem_flags.READ_ONLY|cl.mem_flags.COPY_HOST_PTR,hostbuf=values)
        target=cl.Buffer(self.context,cl.mem_flags.WRITE_ONLY,out.nbytes)
        try:
            cl.Kernel(self.program,'search_list')(self.queue,(len(values),),None,source,target)
            cl.enqueue_copy(self.queue,out,target).wait()
            return values[out.astype(bool)].tolist()
        finally:source.release();target.release()

    def diagnostic(self, start, count):
        np,cl=self.np,self.cl
        out=np.empty((count,9),dtype=np.int32)
        buffer=cl.Buffer(self.context,cl.mem_flags.WRITE_ONLY,out.nbytes)
        try:
            kernel=cl.Kernel(self.program,'diagnostics')
            kernel(self.queue,(count,),None,np.uint32(start),buffer)
            cl.enqueue_copy(self.queue,out,buffer).wait()
            return out
        finally:
            buffer.release()

    def diagnostic_perks(self, start, count):
        np,cl=self.np,self.cl
        out=np.empty((count,129),dtype=np.int32)
        buffer=cl.Buffer(self.context,cl.mem_flags.WRITE_ONLY,out.nbytes)
        try:
            kernel=cl.Kernel(self.program,'diagnostic_perks')
            kernel(self.queue,(count,),None,np.uint32(start),buffer)
            cl.enqueue_copy(self.queue,out,buffer).wait()
            return [[PERKS[int(v)] for v in row[1:1+int(row[0])]] for row in out]
        finally:
            buffer.release()
