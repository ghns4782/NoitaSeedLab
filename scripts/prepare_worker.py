"""Brand a private copy of Node; never modify the installed runtime."""
from pathlib import Path
import shutil


def prepare_worker(node, root):
    from PyInstaller.utils.win32 import versioninfo as v, icon
    target=Path(root)/'.native-build/worker/NoitaSeedLab.Worker.exe'
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(node,target)
    original=v.read_version_info_from_executable(str(target))
    # Preserve the runtime's version and attribution, including FileVersion:
    # Windows uses it when choosing the translated string table.
    strings={s.name:s.val for kid in original.kids if isinstance(kid,v.StringFileInfo)
             for table in kid.kids for s in table.kids}
    info=v.VSVersionInfo(ffi=original.ffi,kids=[
        v.StringFileInfo([v.StringTable('040904b0',[
            v.StringStruct('FileDescription','NoitaSeedLab · 计算子进程'),
            v.StringStruct('ProductName','NoitaSeedLab'),
            v.StringStruct('FileVersion',strings.get('FileVersion','1.0.0')),
            v.StringStruct('ProductVersion',strings.get('ProductVersion','1.0.0')),
            v.StringStruct('CompanyName','NoitaSeedLab / Node.js contributors'),
            v.StringStruct('LegalCopyright',strings.get('LegalCopyright','Copyright Node.js contributors. MIT license.')),
            v.StringStruct('InternalName','NoitaSeedLab.Worker'),
            v.StringStruct('OriginalFilename','NoitaSeedLab.Worker.exe'),
            v.StringStruct('Comments','NoitaSeedLab 私有计算内核，基于 Node.js；许可证见 licenses/node-LICENSE'),
        ])]),v.VarFileInfo([v.VarStruct('Translation',[0x0409,1200])])])
    v.write_version_info_to_executable(str(target),info)
    icon.CopyIcons_FromIco(str(target),[str(Path(root)/'vendor/noita-tools-master/public/favicon.ico')])
    # Resource edits invalidate the upstream signature. Remove the obsolete
    # certificate directory instead of shipping a misleading broken signature.
    import pefile
    pe=pefile.PE(str(target),fast_load=True)
    security=pe.OPTIONAL_HEADER.DATA_DIRECTORY[4]
    security.VirtualAddress=0;security.Size=0
    pe.OPTIONAL_HEADER.CheckSum=0
    image=pe.write();pe.close();target.write_bytes(image)
    return str(target)
