"""Stream large raster maps into cached Deep Zoom tiles with libvips."""
import hashlib
import os
import shutil
import sys
import threading
import uuid
from pathlib import Path
from .paths import ROOT,STATE

_lock=threading.Lock()
_dll_handles=[]

def vips_module():
    folder=ROOT/'.map-deps'
    if folder.is_dir():
        if str(folder) not in sys.path:sys.path.insert(0,str(folder))
        if os.name=='nt' and not _dll_handles:_dll_handles.append(os.add_dll_directory(str(folder)))
    os.environ.setdefault('VIPS_CONCURRENCY','2')
    os.environ.setdefault('VIPS_DISC_THRESHOLD','64m')
    import pyvips
    pyvips.cache_set_max_mem(32*1024*1024);pyvips.cache_set_max(0)
    return pyvips

def prepare_raster(path,on_progress=None,cache=None):
    """No full-size QImage/QPixmap allocation, even for a 500 MB PNG."""
    path=Path(path).resolve();stat=path.stat()
    key=hashlib.sha256(f'{path}:{stat.st_size}:{stat.st_mtime_ns}:v1'.encode()).hexdigest()[:24]
    cache=Path(cache or STATE/'.cache/map-tiles');cache.mkdir(parents=True,exist_ok=True)
    target=cache/key
    def progress(value):
        if on_progress:on_progress({'value':value,'phase':'正在流式生成高清地图切片'})
    with _lock:
        if (target/'complete').is_file():progress(100);return target/'map.dzi'
        working=cache/('building-'+uuid.uuid4().hex);working.mkdir()
        try:
            vips=vips_module();image=vips.Image.new_from_file(str(path),access='sequential',fail_on='error')
            image.set_progress(True);last=[-1]
            def tick(image,info):
                value=min(99,int(info.percent))
                if value>last[0]:last[0]=value;progress(value)
            image.signal_connect('eval',tick);progress(0)
            image.dzsave(str(working/'map'),tile_size=512,overlap=0,suffix='.png[compression=3,strip]',depth='onepixel',region_shrink='nearest')
            (working/'complete').write_text(key,encoding='ascii')
            working.rename(target);progress(100);return target/'map.dzi'
        except Exception:
            # Only remove the temporary directory created by this invocation.
            if working.parent.resolve()==cache.resolve() and working.name.startswith('building-'):shutil.rmtree(working)
            raise
