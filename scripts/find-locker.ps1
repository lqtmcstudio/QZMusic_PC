# Find processes locking a file via Restart Manager API
param([string]$TargetPath = 'D:\Mist Aperio Studio\QZMusic_PC\release\win-unpacked\resources\app.asar')

$signature = @'
using System;
using System.Runtime.InteropServices;

public static class RestartManager {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string strServiceShortName;
        public int ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, RM_UNIQUE_PROCESS[] rgApplications, uint nServices, string[] rgsServiceNames);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);
    [DllImport("rstrtmgr.dll")]
    public static extern int RmEndSession(uint pSessionHandle);
    [DllImport("rstrtmgr.dll")]
    public static extern int RmGetList(uint dwSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);
}
'@
Add-Type -TypeDefinition $signature

$handle = [uint32]0
$key = [Guid]::NewGuid().ToString()
$res = [RestartManager]::RmStartSession([ref]$handle, 0, $key)
if ($res -ne 0) { Write-Error "RmStartSession failed: $res"; exit 1 }

try {
    $res = [RestartManager]::RmRegisterResources($handle, 1, @($TargetPath), 0, $null, 0, $null)
    if ($res -ne 0) { Write-Error "RmRegisterResources failed: $res"; exit 1 }
    $needed = [uint32]0
    $count = [uint32]10
    $info = New-Object RestartManager+RM_PROCESS_INFO[] 10
    $reasons = [uint32]0
    $res = [RestartManager]::RmGetList($handle, [ref]$needed, [ref]$count, $info, [ref]$reasons)
    if ($res -ne 0) { Write-Error "RmGetList failed: $res"; exit 1 }
    if ($count -eq 0) { Write-Output "No process locks this file"; exit 0 }
    for ($i = 0; $i -lt $count; $i++) {
        $lockerPid = $info[$i].Process.dwProcessId
        $app = $info[$i].strAppName
        $proc = Get-Process -Id $lockerPid -ErrorAction SilentlyContinue
        $path = if ($proc) { $proc.Path } else { '(process exited)' }
        Write-Output "PID=$lockerPid  App=$app  Path=$path"
    }
} finally {
    [RestartManager]::RmEndSession($handle) | Out-Null
}
