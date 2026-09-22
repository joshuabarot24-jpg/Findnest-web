"use client";
import { useState, useEffect } from "react";
import api, { logoutUser } from "@/lib/api";

interface LogEntry {
  action: string;
  performed_by: string;
  created_at: string;
  details: string;
}

export default function SystemManagement() {
  const [sensitivity, setSensitivity] = useState(75);
  const [savedSensitivity, setSavedSensitivity] = useState(75);
  const [sensitivityLoading, setSensitivityLoading] = useState(true);
  const [sensitivitySaving, setSensitivitySaving] = useState(false);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState("Never");
  const [backups, setBackups] = useState<{ filename: string; size_kb: number; created_at: number }[]>([]);
  const [showBackupsList, setShowBackupsList] = useState(false);

  const [totalRecords, setTotalRecords] = useState(0);
  const [dbSizeGb, setDbSizeGb] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchSettings = async () => {
    try {
      const response = await api.get("/system-settings");
      const value = response.data.match_confidence_threshold ?? 75;
      setSensitivity(value);
      setSavedSensitivity(value);
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setSensitivityLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/system-stats");
      setTotalRecords(response.data.total_records || 0);
      setDbSizeGb(response.data.db_size_gb || 0);
    } catch (err) {
      console.error("Error fetching system stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await api.get("/audit-logs");
      setLogs(response.data.logs?.data || []);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await api.get("/system/backups");
      const list = response.data.backups || [];
      setBackups(list);
      if (list.length > 0) {
        setLastBackup(new Date(list[0].created_at * 1000).toLocaleString());
      }
    } catch (err) {
      console.error("Error fetching backups:", err);
    }
  };

  const fetchMaintenanceMode = async () => {
    try {
      const response = await api.get("/system/maintenance-mode");
      setMaintenanceMode(response.data.maintenance_mode);
    } catch (err) {
      console.error("Error fetching maintenance mode:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchStats();
    fetchLogs();
    fetchBackups();
    fetchMaintenanceMode();
  }, []);

  async function handleSaveSensitivity() {
    setSensitivitySaving(true);
    try {
      await api.put("/system-settings", { match_confidence_threshold: sensitivity });
      setSavedSensitivity(sensitivity);
      setToast(`Match confidence threshold updated to ${sensitivity}%.`);
    } catch (err) {
      console.error("Error saving settings:", err);
      setToast("Failed to update threshold.");
    } finally {
      setSensitivitySaving(false);
    }
  }

  async function handleBackupNow() {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const response = await api.post("/system/backup");
      setLastBackup(new Date(response.data.created_at).toLocaleString());
      setToast(`Backup completed — ${response.data.record_count.lost_item_reports} lost reports, ${response.data.record_count.claims} claims saved.`);
      fetchBackups();
    } catch (err) {
      console.error("Backup failed:", err);
      setToast("Backup failed. Please try again.");
    } finally {
      setIsBackingUp(false);
    }
  }

  function downloadBackup(filename: string) {
    const token = localStorage.getItem("findnest_token");
    const baseUrl = api.defaults.baseURL;
    window.open(`${baseUrl}/system/backups/${filename}?token=${token}`, "_blank");
  }

  function requestMaintenanceToggle() {
    setShowMaintenanceConfirm(true);
  }

  async function confirmMaintenanceToggle() {
    const next = !maintenanceMode;
    try {
      await api.post("/system/maintenance-mode", { maintenance_mode: next });
      setMaintenanceMode(next);
      setShowMaintenanceConfirm(false);
      setToast(
        next
          ? "Maintenance mode enabled. Students and admins are locked out."
          : "Maintenance mode disabled. System is back online."
      );
    } catch (err) {
      console.error("Error toggling maintenance mode:", err);
      setToast("Failed to update maintenance mode.");
      setShowMaintenanceConfirm(false);
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  const hasUnsavedChange = sensitivity !== savedSensitivity;

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] bg-[#1a237e] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      <aside className="w-72 bg-[#1a237e] min-h-screen flex flex-col fixed left-0 top-0 bottom-0">
        <div className="flex items-center gap-3 px-6 py-6">
          <div>
            <a href="/user-management" className="text-white font-black text-lg block">
              FIND<span className="text-[#ffd700]">NEST</span>
            </a>
            <span className="text-blue-300 text-xs">Super Admin Panel</span>
          </div>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-4"></div>

        <nav className="flex flex-col gap-1 px-4 flex-1">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-wider px-4 mb-2">Management</p>

          <a
            href="/user-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium"
          >
            <span>User Management</span>
          </a>

          <a
            href="/admin-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium"
          >
            <span>Admin Management</span>
          </a>

          <a
            href="/system-management"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/20 text-white font-semibold border border-white/20"
          >
            <span>System Management</span>
          </a>

          <a
            href="/super-admin-records"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium"
          >
            <span>Digital Records</span>
          </a>
        </nav>

        <div className="px-4 py-6">
          <div className="bg-white/10 rounded-2xl p-4 mb-4">
            <p className="text-white text-sm font-semibold">Super Admin</p>
            <p className="text-blue-300 text-xs mt-1">System Administrator</p>
          </div>

          <button
            onClick={logoutUser}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200 hover:bg-white/10 transition font-medium w-full text-left"
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-72 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#1a237e]">System Management</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage software versions, updates, maintenance, and deployments
          </p>
        </div>

        {maintenanceMode && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-5 py-3 rounded-xl">
            Maintenance mode is currently active. Students and admins cannot access the system.
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">System Version</p>
            <p className="text-3xl font-black text-[#1a237e] mt-1">v2.0.0</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">System Status</p>
            <p className={`text-3xl font-black mt-1 ${maintenanceMode ? "text-red-500" : "text-green-600"}`}>
              {maintenanceMode ? "Maintenance" : "Online"}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm font-medium">Last Backup</p>
            <p className="text-3xl font-black text-[#ffd700] mt-1">{lastBackup}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="mb-6">
              <h2 className="font-black text-gray-700 text-lg">AI Matching Sensitivity</h2>
              <p className="text-gray-400 text-sm">Minimum confidence score for the AI to create a lost-found match</p>
            </div>

            {sensitivityLoading ? (
              <p className="text-gray-400 text-sm">Loading current threshold...</p>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-500">Flexible</span>
                    <span className="text-2xl font-black text-[#1a237e]">{sensitivity}%</span>
                    <span className="text-sm font-bold text-gray-500">Strict</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value))}
                    className="w-full accent-[#1a237e]"
                  />
                </div>

                <div
                  className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${
                    sensitivity >= 80
                      ? "bg-green-50 text-green-700"
                      : sensitivity >= 65
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {sensitivity >= 80
                    ? "High accuracy — fewer false matches"
                    : sensitivity >= 65
                    ? "Moderate — balanced matching"
                    : "Low — may produce false matches"}
                </div>

                <button
                  onClick={handleSaveSensitivity}
                  disabled={sensitivitySaving || !hasUnsavedChange}
                  className="w-full bg-[#1a237e] hover:bg-[#283593] text-white font-bold py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sensitivitySaving ? "Saving..." : hasUnsavedChange ? "Save Changes" : "Saved"}
                </button>
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="mb-6">
              <h2 className="font-black text-gray-700 text-lg">Database Maintenance</h2>
              <p className="text-gray-400 text-sm">Manage database backups and records</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-bold text-gray-700 text-sm">Total Records</p>
                  <p className="text-gray-400 text-xs mt-0.5">All system data</p>
                </div>
                <span className="text-2xl font-black text-[#1a237e]">
                  {statsLoading ? "..." : totalRecords.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-bold text-gray-700 text-sm">Database Size</p>
                  <p className="text-gray-400 text-xs mt-0.5">Current usage</p>
                </div>
                <span className="text-2xl font-black text-[#1a237e]">
                  {statsLoading ? "..." : `${dbSizeGb} GB`}
                </span>
              </div>

              <button
                onClick={handleBackupNow}
                disabled={isBackingUp}
                className="w-full bg-[#ffd700] hover:bg-yellow-400 text-[#1a237e] font-black py-3 rounded-xl transition shadow-sm hover:-translate-y-0.5 transform disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              >
                {isBackingUp ? "Backing Up..." : "Backup Records Now"}
              </button>

              {backups.length > 0 && (
                <button
                  onClick={() => setShowBackupsList(true)}
                  className="w-full text-sm font-bold text-[#1a237e] hover:underline"
                >
                  View Backup History ({backups.length})
                </button>
              )}

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-bold text-gray-700 text-sm">Maintenance Mode</p>
                  <p className="text-gray-400 text-xs mt-0.5">Disable system access temporarily</p>
                </div>
                <button
                  onClick={requestMaintenanceToggle}
                  className={`w-12 h-6 rounded-full transition-all duration-300 ${
                    maintenanceMode ? "bg-red-500" : "bg-gray-300"
                  } relative`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                      maintenanceMode ? "left-6" : "left-0.5"
                    }`}
                  ></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="font-black text-gray-700">System Logs</h2>
              <p className="text-gray-400 text-xs">All system activities are being recorded for auditing</p>
            </div>
            <button
              onClick={() => setShowAllLogs(true)}
              className="text-sm font-bold text-[#1a237e] hover:underline"
            >
              View All Logs
            </button>
          </div>

          {logsLoading ? (
            <div className="px-6 py-16 text-center text-gray-400 text-sm">Loading logs...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.slice(0, 5).map((log, index) => (
                <div key={index} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition">
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{log.action}</p>
                    <p className="text-gray-400 text-xs mt-0.5">By: {log.performed_by}</p>
                  </div>
                  <span className="text-gray-400 text-xs">{formatTime(log.created_at)}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="px-6 py-16 text-center text-gray-400 text-sm">No logs yet.</div>
              )}
            </div>
          )}
        </div>
      </main>

      {showMaintenanceConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
            <h2 className="text-xl font-black text-[#1a237e] mb-2">
              {maintenanceMode ? "Disable Maintenance Mode?" : "Enable Maintenance Mode?"}
            </h2>
            <p className="text-gray-400 text-sm mb-8">
              {maintenanceMode
                ? "Students and admins will regain access to FindNest immediately."
                : "Students and admins will be locked out of FindNest until you disable this."}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowMaintenanceConfirm(false)}
                className="flex-1 border-2 border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmMaintenanceToggle}
                className={`flex-1 text-white font-bold py-3 rounded-2xl transition ${
                  maintenanceMode ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {maintenanceMode ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackupsList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-8 max-h-[80vh] flex flex-col">
            <button
              onClick={() => setShowBackupsList(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">Backup History</h2>
            <p className="text-gray-400 text-sm mb-6">Download any previous backup file</p>

            <div className="overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-2xl">
              {backups.map((b) => (
                <div key={b.filename} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{b.filename}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{new Date(b.created_at * 1000).toLocaleString()} &middot; {b.size_kb} KB</p>
                  </div>
                  <button
                    onClick={() => downloadBackup(b.filename)}
                    className="text-xs font-bold text-[#1a237e] hover:underline shrink-0"
                  >
                    Download
                  </button>
                </div>
              ))}
              {backups.length === 0 && (
                <div className="px-6 py-16 text-center text-gray-400 text-sm">No backups yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAllLogs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1757]/70 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 p-8 max-h-[80vh] flex flex-col">
            <button
              onClick={() => setShowAllLogs(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl font-bold leading-none"
            >
              &times;
            </button>

            <h2 className="text-2xl font-black text-[#1a237e] mb-1">System Logs</h2>
            <p className="text-gray-400 text-sm mb-6">
              Complete history of all recorded system activity
            </p>

            <div className="overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-2xl">
              {logs.map((log, index) => (
                <div key={index} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">{log.action}</p>
                    <p className="text-gray-400 text-xs mt-0.5">By: {log.performed_by}</p>
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{formatTime(log.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}