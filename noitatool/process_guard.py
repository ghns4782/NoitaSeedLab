"""Own the application's process tree, including on forced Windows exit."""
import os
import threading
import subprocess

_lock=threading.Lock()
_job=None


def ensure_process_job():
    """Only computing children join this job; its non-inherited handle lives
    until Windows tears down the owner. External browser processes stay outside.
    """
    global _job
    if os.name!='nt':return None
    with _lock:
        if _job is not None:return _job
        import ctypes as c
        from ctypes import wintypes as w
        class BasicLimits(c.Structure):
            _fields_=[('process_time',c.c_longlong),('job_time',c.c_longlong),('flags',w.DWORD),
                      ('min_working_set',c.c_size_t),('max_working_set',c.c_size_t),
                      ('active_processes',w.DWORD),('affinity',c.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
        class IoCounters(c.Structure):
            _fields_=[(name,c.c_ulonglong) for name in ('read_ops','write_ops','other_ops','read_bytes','write_bytes','other_bytes')]
        class ExtendedLimits(c.Structure):
            _fields_=[('basic',BasicLimits),('io',IoCounters),('process_memory',c.c_size_t),
                      ('job_memory',c.c_size_t),('peak_process_memory',c.c_size_t),('peak_job_memory',c.c_size_t)]
        api=c.WinDLL('kernel32',use_last_error=True)
        api.CreateJobObjectW.argtypes=[c.c_void_p,w.LPCWSTR];api.CreateJobObjectW.restype=w.HANDLE
        api.SetInformationJobObject.argtypes=[w.HANDLE,c.c_int,c.c_void_p,w.DWORD];api.SetInformationJobObject.restype=w.BOOL
        api.CloseHandle.argtypes=[w.HANDLE]
        job=api.CreateJobObjectW(None,None)
        if not job:raise c.WinError(c.get_last_error())
        limits=ExtendedLimits();limits.basic.flags=0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not api.SetInformationJobObject(job,9,c.byref(limits),c.sizeof(limits)):
            error=c.get_last_error();api.CloseHandle(job);raise c.WinError(error)
        _job=job
        return job


def _create_in_job(command,cwd,flags,stdin,stdout,stderr):
    """Windows 10+ atomic job assignment, with an explicit pipe handle list.

    No suspended/orphan gap and no process-wide monkeypatch of CreateProcess.
    """
    import ctypes as c
    from ctypes import wintypes as w
    class Startup(c.Structure):
        _fields_=[('cb',w.DWORD),('reserved',w.LPWSTR),('desktop',w.LPWSTR),('title',w.LPWSTR),
                  *[(name,w.DWORD) for name in ('x','y','width','height','chars_x','chars_y','fill','flags')],
                  ('show',w.WORD),('reserved_bytes',w.WORD),('reserved_data',c.c_void_p),
                  ('stdin',w.HANDLE),('stdout',w.HANDLE),('stderr',w.HANDLE)]
    class StartupEx(c.Structure):_fields_=[('startup',Startup),('attributes',c.c_void_p)]
    class ProcessInfo(c.Structure):_fields_=[('process',w.HANDLE),('thread',w.HANDLE),('pid',w.DWORD),('tid',w.DWORD)]
    api=c.WinDLL('kernel32',use_last_error=True)
    api.InitializeProcThreadAttributeList.argtypes=[c.c_void_p,w.DWORD,w.DWORD,c.POINTER(c.c_size_t)];api.InitializeProcThreadAttributeList.restype=w.BOOL
    api.UpdateProcThreadAttribute.argtypes=[c.c_void_p,w.DWORD,c.c_size_t,c.c_void_p,c.c_size_t,c.c_void_p,c.c_void_p];api.UpdateProcThreadAttribute.restype=w.BOOL
    api.DeleteProcThreadAttributeList.argtypes=[c.c_void_p]
    api.CreateProcessW.argtypes=[w.LPCWSTR,w.LPWSTR,c.c_void_p,c.c_void_p,w.BOOL,w.DWORD,c.c_void_p,w.LPCWSTR,c.POINTER(StartupEx),c.POINTER(ProcessInfo)];api.CreateProcessW.restype=w.BOOL
    size=c.c_size_t();api.InitializeProcThreadAttributeList(None,2,0,c.byref(size))
    if not size.value:raise c.WinError(c.get_last_error())
    attributes=c.create_string_buffer(size.value)
    if not api.InitializeProcThreadAttributeList(attributes,2,0,c.byref(size)):raise c.WinError(c.get_last_error())
    job=(w.HANDLE*1)(ensure_process_job());handles=list(dict.fromkeys([int(stdin),int(stdout),int(stderr)]))
    pipes=(w.HANDLE*len(handles))(*handles)
    try:
        for attribute,value in [(0x0002000D,job),(0x00020002,pipes)]:
            if not api.UpdateProcThreadAttribute(attributes,0,attribute,c.byref(value),c.sizeof(value),None,None):raise c.WinError(c.get_last_error())
        startup=StartupEx();startup.startup.cb=c.sizeof(startup);startup.startup.flags=0x100
        startup.startup.stdin=int(stdin);startup.startup.stdout=int(stdout);startup.startup.stderr=int(stderr)
        startup.attributes=c.cast(attributes,c.c_void_p)
        info=ProcessInfo();line=c.create_unicode_buffer(subprocess.list2cmdline([os.fspath(arg) for arg in command]))
        if not api.CreateProcessW(os.fspath(command[0]),line,None,None,True,flags|0x80000|0x400,None,os.fspath(cwd),c.byref(startup),c.byref(info)):
            raise c.WinError(c.get_last_error())
        return info.process,info.thread,info.pid
    finally:api.DeleteProcThreadAttributeList(attributes)


class OwnedPopen(subprocess.Popen):
    if os.name=='nt':
        def _execute_child(self,args,executable,preexec_fn,close_fds,pass_fds,cwd,env,startupinfo,creationflags,shell,
                           p2cread,p2cwrite,c2pread,c2pwrite,errread,errwrite,*unused):
            # The engine uses only direct argv, inherited environment, redirected
            # pipes and CREATE_NO_WINDOW. Popen still owns text I/O and waiting.
            if shell or executable is not None or env is not None or startupinfo is not None:
                raise ValueError('Unsupported computing process startup options')
            import _winapi
            import sys
            sys.audit('subprocess.Popen',os.fspath(args[0]),args,cwd,env)
            try:hp,ht,pid=_create_in_job(args,cwd,creationflags,p2cread,c2pwrite,errwrite)
            finally:self._close_pipe_fds(p2cread,p2cwrite,c2pread,c2pwrite,errread,errwrite)
            self._child_created=True;self._handle=subprocess.Handle(hp);self.pid=pid
            _winapi.CloseHandle(ht)


def set_application_identity():
    """Stable taskbar/window identity; Task Manager presentation is OS-owned."""
    if os.name=='nt':
        import ctypes
        shell=ctypes.WinDLL('shell32')
        shell.SetCurrentProcessExplicitAppUserModelID.argtypes=[ctypes.c_wchar_p]
        shell.SetCurrentProcessExplicitAppUserModelID('NoitaSeedLab.LocalSeedWorkshop')
