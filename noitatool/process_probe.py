"""Explicit diagnostics for verifying the packaged process owner boundary."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time


def parent_process_id(pid):
    """Read Windows' process tree, independently of the launcher's bookkeeping."""
    import ctypes as c
    from ctypes import wintypes as w
    class Entry(c.Structure):
        _fields_=[('size',w.DWORD),('usage',w.DWORD),('pid',w.DWORD),('heap',c.c_size_t),
                  ('module',w.DWORD),('threads',w.DWORD),('parent',w.DWORD),
                  ('priority',w.LONG),('flags',w.DWORD),('exe',w.WCHAR*260)]
    api=c.WinDLL('kernel32',use_last_error=True)
    api.CreateToolhelp32Snapshot.argtypes=[w.DWORD,w.DWORD];api.CreateToolhelp32Snapshot.restype=w.HANDLE
    api.Process32FirstW.argtypes=[w.HANDLE,c.POINTER(Entry)];api.Process32FirstW.restype=w.BOOL
    api.Process32NextW.argtypes=[w.HANDLE,c.POINTER(Entry)];api.Process32NextW.restype=w.BOOL
    api.CloseHandle.argtypes=[w.HANDLE]
    handle=api.CreateToolhelp32Snapshot(2,0)
    if handle==c.c_void_p(-1).value:raise c.WinError(c.get_last_error())
    try:
        entry=Entry();entry.size=c.sizeof(entry);found=api.Process32FirstW(handle,c.byref(entry))
        while found:
            if entry.pid==pid:return entry.parent
            found=api.Process32NextW(handle,c.byref(entry))
        raise RuntimeError('计算子进程未出现在 Windows 进程列表中')
    finally:api.CloseHandle(handle)


def hold_engine(report):
    from .engine import Engine
    with Engine() as engine:
        engine.info(123)
        # Queue a long CPU batch before publishing readiness. An idle Node can
        # exit on pipe EOF without a Job; this must test a busy child instead.
        engine.process.stdin.write(json.dumps({'op':'search','start':1,'end':2147483645,
            'rule':{'type':'startingFlask','val':'water'}})+'\n');engine.process.stdin.flush()
        path=Path(report);temporary=path.with_suffix('.tmp')
        temporary.write_text(json.dumps({'owner':os.getpid(),'node':engine.process.pid,
            'workerImage':engine.process.args[0]}),encoding='utf-8');temporary.replace(path)
        threading.Event().wait(60)
    return 0


def verify_owner_exit(command,folder):
    """Terminate only a fresh diagnostic instance, then wait on its Node handle."""
    import ctypes as c
    from ctypes import wintypes as w
    api=c.WinDLL('kernel32',use_last_error=True)
    api.OpenProcess.argtypes=[w.DWORD,w.BOOL,w.DWORD];api.OpenProcess.restype=w.HANDLE
    api.WaitForSingleObject.argtypes=[w.HANDLE,w.DWORD];api.WaitForSingleObject.restype=w.DWORD
    api.CloseHandle.argtypes=[w.HANDLE]
    api.TerminateProcess.argtypes=[w.HANDLE,w.UINT]
    with tempfile.TemporaryDirectory(dir=folder) as temporary:
        report=Path(temporary)/'owner.json'
        owner=subprocess.Popen([*command,'--engine-owner-probe',str(report)],creationflags=subprocess.CREATE_NO_WINDOW,
                               stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        handle=None
        try:
            deadline=time.monotonic()+15
            while not report.exists() and owner.poll() is None and time.monotonic()<deadline:time.sleep(.02)
            if not report.exists():raise RuntimeError('计算进程归属自检未启动')
            ids=json.loads(report.read_text(encoding='utf-8'));handle=api.OpenProcess(0x100001,False,ids['node'])
            if not handle:raise c.WinError(c.get_last_error())
            actual_parent=parent_process_id(ids['node'])
            if actual_parent!=owner.pid:raise RuntimeError('计算进程并非主程序的直接子进程')
            worker_image=Path(ids['workerImage']).name
            if len(command)==1 and worker_image!='NoitaSeedLab.Worker.exe':raise RuntimeError('打包版未使用专属计算子进程')
            owner.terminate();owner.wait(timeout=5)
            if api.WaitForSingleObject(handle,5000)!=0:raise RuntimeError('主程序退出后计算子进程未结束')
            return {'forcedOwnerExit':True,'busyNodeReaped':True,'directChild':True,'workerImage':worker_image}
        finally:
            if owner.poll() is None:owner.kill();owner.wait(timeout=5)
            if handle:
                if api.WaitForSingleObject(handle,0)!=0:api.TerminateProcess(handle,1);api.WaitForSingleObject(handle,5000)
                api.CloseHandle(handle)
