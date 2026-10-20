"""Report missing imports in the packaged Qt dependency chain."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'.build-deps'))
import pefile
project=Path(__file__).resolve().parent.parent
candidates=[*project.glob('dist/releases/*/NoitaSeedLab/_internal'),*project.glob('dist/releases/*/Noitatool/_internal')]
root=Path(sys.argv[1]).resolve()/'_internal' if len(sys.argv)>1 else max(candidates,key=lambda p:p.stat().st_mtime)
folders=[root,root/'PySide6',root/'shiboken6',Path('C:/Windows/System32')]
seen=set();missing=[]
def visit(path):
    if path in seen:return
    seen.add(path);pe=pefile.PE(str(path),fast_load=True,max_symbol_exports=65536);pe.parse_data_directories(directories=[1,0])
    for entry in getattr(pe,'DIRECTORY_ENTRY_IMPORT',[]):
        dll=entry.dll.decode();target=next((f/dll for f in folders if (f/dll).exists()),None)
        if target is None:continue
        dep=pefile.PE(str(target),fast_load=True,max_symbol_exports=65536);dep.parse_data_directories(directories=[0]);exports=getattr(dep,'DIRECTORY_ENTRY_EXPORT',None)
        names={s.name for s in exports.symbols} if exports else set();ordinals={s.ordinal for s in exports.symbols} if exports else set()
        for symbol in entry.imports:
            if (symbol.name and symbol.name not in names) or (not symbol.name and symbol.ordinal not in ordinals):missing.append((path.name,dll,symbol.name or symbol.ordinal))
        if target.is_relative_to(root):visit(target)
visit(root/'PySide6/QtWidgets.pyd')
print(*missing,sep='\n')
