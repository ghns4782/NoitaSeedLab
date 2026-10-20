"""Read a frozen executable's module archive and measure shipped dependencies."""
import ast
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'.build-deps'))
from PyInstaller.archive.readers import CArchiveReader


def group_name(name):
    if name in ('win32','win32api','pywintypes','pythoncom','pywin32_system32'):return 'pywin32'
    if name=='_cffi_backend':return 'cffi'
    if name=='_libvips':return 'pyvips-binary'
    if name=='_distutils_hack':return 'setuptools'
    return name


def inspect(release):
    release=Path(release).resolve();internal=release/'_internal'
    executable=release/'NoitaSeedLab.exe'
    if not executable.is_file():executable=release/'Noitatool.exe'
    archive=CArchiveReader(str(executable))
    pyz=archive.open_embedded_archive(next(name for name,row in archive.toc.items() if row[-1]=='z'))
    code=defaultdict(int);modules=defaultdict(list);stdlib_code=0
    for name,row in pyz.toc.items():
        package=group_name(name.split('.')[0]);length=row[2]
        if package in sys.stdlib_module_names or package.startswith(('_pyi_','pyi_')):stdlib_code+=length
        else:code[package]+=length;modules[package].append(name)
    packages={name:{'package':name,'codeBytes':size,'fileBytes':0,'modules':sorted(modules[name])} for name,size in code.items()}
    package_lookup={name.lower():name for name in packages}
    shared=defaultdict(int);files=list(internal.rglob('*'))
    for path in files:
        if not path.is_file():continue
        parts=path.relative_to(internal).parts;head=parts[0];lower=head.lower();size=path.stat().st_size
        if lower.startswith('libvips-') or lower.startswith('_libvips.'):package='pyvips-binary'
        elif lower.startswith('_cffi_backend.'):package='cffi'
        elif lower.startswith('siphash24.'):package='siphash24'
        elif lower.startswith(('numpy.libs','numpy-')):package='numpy'
        elif lower.startswith(('pyopencl.libs','pyopencl-')):package='pyopencl'
        elif lower in ('win32','pywin32_system32'):package='pywin32'
        else:
            key=lower.split('.dist-info')[0].split('-')[0]
            package=package_lookup.get(key)
        if package:
            row=packages.setdefault(package,{'package':package,'codeBytes':0,'fileBytes':0,'modules':[]});row['fileBytes']+=size
        else:shared[head]+=size
    for row in packages.values():row['bytes']=row['codeBytes']+row['fileBytes']
    imports=defaultdict(set)
    for folder in ['noitatool','scripts','tests']:
        for path in (ROOT/folder).glob('*.py'):
            for node in ast.walk(ast.parse(path.read_text(encoding='utf-8-sig'))):
                if isinstance(node,ast.Import):imports[folder].update(n.name.split('.')[0] for n in node.names)
                elif isinstance(node,ast.ImportFrom) and not node.level and node.module:imports[folder].add(node.module.split('.')[0])
    js=defaultdict(int)
    metadata_path=ROOT/'artifacts/engine-inputs.json'
    if metadata_path.is_file():
        metadata=json.loads(metadata_path.read_text(encoding='utf-8'))
        for stage in ('seed','map'):
            for output in metadata[stage]['outputs'].values():
                for name,row in output['inputs'].items():
                    if name.startswith('node_modules/'):
                        parts=name.split('/');package='/'.join(parts[1:3]) if parts[1].startswith('@') else parts[1]
                        js[package]+=row['bytesInOutput']
    third_party=sorted((row for name,row in packages.items() if name!='noitatool'),key=lambda row:-row['bytes'])
    return {'release':str(release),'internalBytes':sum(p.stat().st_size for p in files if p.is_file()),
            'totalBytes':sum(p.stat().st_size for p in release.rglob('*') if p.is_file()),
            'thirdParty':third_party,'project':packages.get('noitatool'),
            'pythonStandardLibraryCodeBytes':stdlib_code,'otherInternalFiles':dict(sorted(shared.items(),key=lambda row:-row[1])),
            'sourceImports':{k:sorted(v) for k,v in imports.items()},'embeddedJavaScriptCodeBytes':dict(js)}


if __name__=='__main__':
    release=Path(sys.argv[1]) if len(sys.argv)>1 else max([*ROOT.glob('dist/releases/*/NoitaSeedLab'),*ROOT.glob('dist/releases/*/Noitatool')],key=lambda p:p.stat().st_mtime)
    result=inspect(release);output=ROOT/'artifacts/package-inventory.json'
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Total MiB:',round(result['totalBytes']/1048576,2),'_internal MiB:',round(result['internalBytes']/1048576,2))
    for row in result['thirdParty']:print(row['package'],f"{row['bytes']/1048576:.4f} MiB")
    print('Embedded JavaScript:',result['embeddedJavaScriptCodeBytes'])
    print('Other largest files:',dict(list(result['otherInternalFiles'].items())[:16]))
