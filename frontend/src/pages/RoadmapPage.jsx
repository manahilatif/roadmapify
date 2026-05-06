import { useState, useCallback } from "react";
import ChatButton from "../components/ChatButton";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TYPE_ICONS = {
  video: "▶",
  article: "📄",
  documentation: "📚",
  book: "📖",
  platform: "🖥",
};

const TYPE_COLORS = {
  video: "#ef4444",
  article: "#3b82f6",
  documentation: "#10b981",
  book: "#8b5cf6",
  platform: "#f59e0b",
};

// Changed 'roadmap' to 'data' to match App.jsx prop name
export default function RoadmapPage({ data: initialRoadmap, onBack }) {
  const [roadmap, setRoadmap] = useState(initialRoadmap);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeResource, setActiveResource] = useState(null);
  const [completedModules, setCompletedModules] = useState(new Set());
  const [updating, setUpdating] = useState(false);
  const [showUpdatePanel, setShowUpdatePanel] = useState(false);
  const [updateType, setUpdateType] = useState("pace");
  const [updateValue, setUpdateValue] = useState("");
  const [newHours, setNewHours] = useState(roadmap?.timeline?.hoursPerWeek || 10);
  const [saveStatus, setSaveStatus] = useState("");

  const modules = roadmap?.modules || [];
  const milestones = roadmap?.milestones || [];
  const activeModule = modules.find((m) => m.id === activeModuleId) || modules[0] || null;

  const progressPct = modules.length
    ? Math.round((completedModules.size / modules.length) * 100)
    : 0;

  const toggleComplete = async (moduleId) => {
    const next = new Set(completedModules);
    const wasCompleted = next.has(moduleId);
    wasCompleted ? next.delete(moduleId) : next.add(moduleId);
    setCompletedModules(next);
    setSaveStatus("Saved ✓");
    setTimeout(() => setSaveStatus(""), 2000);

    try {
      await fetch(`${API_URL}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roadmap_id: roadmap.goal?.slice(0, 20) || "roadmap",
          module_id: moduleId,
          completed: !wasCompleted,
        }),
      });
    } catch (_) { /* non-fatal */ }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`${API_URL}/update-roadmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_roadmap: roadmap,
          change_type: updateType,
          new_value: updateValue,
          hours_per_week: updateType === "pace" ? newHours : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRoadmap(data.roadmap);
        setShowUpdatePanel(false);
        setActiveModuleId(null);
      }
    } catch (e) {
      console.error("Update failed:", e);
    } finally {
      setUpdating(false);
    }
  };

  const openResource = useCallback((url, resource) => {
    setActiveResource(resource);
    if (url && url.startsWith("http")) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "0 24px", display: "flex", alignItems: "center", gap: "16px", height: "60px",
      }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {roadmap?.goal || "Your Roadmap"}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
            {roadmap?.domain} · {roadmap?.totalWeeks} weeks · {roadmap?.timeline?.hoursPerWeek}h/week
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "120px", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "#dc2626", borderRadius: "3px", transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>{progressPct}%</span>
        </div>

        {saveStatus && <span style={{ fontSize: "12px", color: "#10b981" }}>{saveStatus}</span>}

        <button
          onClick={() => setShowUpdatePanel(!showUpdatePanel)}
          style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#dc2626", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
        >
          ✏ Update
        </button>
      </div>

      {showUpdatePanel && (
        <div style={{
          background: "rgba(220,38,38,0.05)", borderBottom: "1px solid rgba(220,38,38,0.15)",
          padding: "16px 24px", display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap",
        }}>
          <div>
            <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Update type</label>
            <select value={updateType} onChange={e => setUpdateType(e.target.value)}
              style={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontSize: "13px" }}>
              <option value="pace">Change pace (hours/week)</option>
              <option value="difficulty">Change difficulty</option>
              <option value="add_module">Add a topic</option>
              <option value="goal">Change goal</option>
            </select>
          </div>
          {updateType === "pace" && (
            <div>
              <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Hours/week</label>
              <input type="number" value={newHours} onChange={e => setNewHours(+e.target.value)} min={1} max={40}
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", width: "80px" }} />
            </div>
          )}
          {updateType !== "pace" && (
            <div>
              <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>
                {updateType === "difficulty" ? "Level (beginner/intermediate/advanced)" : updateType === "add_module" ? "Topic to add" : "New goal"}
              </label>
              <input value={updateValue} onChange={e => setUpdateValue(e.target.value)} placeholder="Type here..."
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", width: "240px" }} />
            </div>
          )}
          <button onClick={handleUpdate} disabled={updating}
            style={{ background: updating ? "rgba(220,38,38,0.3)" : "#dc2626", border: "none", color: "#fff", padding: "9px 20px", borderRadius: "8px", cursor: updating ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600 }}>
            {updating ? "Updating..." : "Apply"}
          </button>
        </div>
      )}

      {roadmap?.architecture?.recommended && (
        <div style={{ margin: "20px 24px 0", padding: "14px 18px", background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: "12px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "18px" }}>🏗</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#dc2626" }}>Recommended Architecture: {roadmap.architecture.recommended}</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginTop: "4px" }}>{roadmap.architecture.reason}</div>
          </div>
        </div>
      )}

      {milestones.length > 0 && (
        <div style={{ margin: "16px 24px", display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          {milestones.map((ms, i) => (
            <div key={i} style={{
              flexShrink: 0, padding: "8px 14px",
              background: completedModules.size >= (modules.filter(m => m.week <= ms.week).length) ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${completedModules.size >= (modules.filter(m => m.week <= ms.week).length) ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: "8px",
            }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Week {ms.week}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>🏆 {ms.title}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "0", minHeight: "calc(100vh - 60px)" }}>
        {/* Module list */}
        <div style={{ width: "320px", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "16px 0" }}>
          {modules.map((mod) => {
            const done = completedModules.has(mod.id);
            const active = activeModuleId === mod.id || (!activeModuleId && mod.id === modules[0]?.id);
            return (
              <div
                key={mod.id}
                onClick={() => setActiveModuleId(mod.id)}
                style={{
                  padding: "14px 20px", cursor: "pointer",
                  background: active ? "rgba(220,38,38,0.08)" : "transparent",
                  borderLeft: active ? "3px solid #dc2626" : "3px solid transparent",
                  transition: "all 0.15s",
                  display: "flex", alignItems: "flex-start", gap: "12px",
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleComplete(mod.id); }}
                  style={{
                    flexShrink: 0, width: "22px", height: "22px", borderRadius: "50%", marginTop: "1px",
                    background: done ? "#dc2626" : "transparent",
                    border: `2px solid ${done ? "#dc2626" : "rgba(255,255,255,0.2)"}`,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "11px",
                  }}
                >
                  {done ? "✓" : ""}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "11px", color: done ? "#10b981" : "rgba(255,255,255,0.4)", marginBottom: "2px" }}>
                    Week {mod.week} · {mod.estimatedHours}h
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: active ? 600 : 400, color: done ? "#10b981" : "#fff", lineHeight: "1.4" }}>
                    {mod.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Module detail */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {activeModule && (
            <>
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>{activeModule.title}</h2>
                  <button
                    onClick={() => toggleComplete(activeModule.id)}
                    style={{
                      background: completedModules.has(activeModule.id) ? "rgba(16,185,129,0.15)" : "rgba(220,38,38,0.1)",
                      border: `1px solid ${completedModules.has(activeModule.id) ? "rgba(16,185,129,0.3)" : "rgba(220,38,38,0.3)"}`,
                      color: completedModules.has(activeModule.id) ? "#10b981" : "#dc2626",
                      padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                    }}
                  >
                    {completedModules.has(activeModule.id) ? "✓ Completed" : "Mark Complete"}
                  </button>
                </div>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                  {activeModule.description}
                </p>
              </div>

              {activeModule.tasks?.length > 0 && (
                <section style={{ marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Tasks</h3>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeModule.tasks.map((task, i) => (
                      <li key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
                        <span style={{ color: "#dc2626", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>{i + 1}.</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {activeModule.resources?.length > 0 && (
                <section style={{ marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Resources</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeModule.resources.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => openResource(res.url, res)}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: "12px 16px",
                          background: activeResource?.url === res.url ? "rgba(220,38,38,0.08)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${activeResource?.url === res.url ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: "10px", cursor: "pointer", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                        onMouseLeave={e => e.currentTarget.style.background = activeResource?.url === res.url ? "rgba(220,38,38,0.08)" : "rgba(255,255,255,0.03)"}
                      >
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
                          background: `${TYPE_COLORS[res.type] || "#666"}20`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px",
                        }}>
                          {TYPE_ICONS[res.type] || "🔗"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 500, color: "#fff", marginBottom: "2px" }}>{res.title}</div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", color: TYPE_COLORS[res.type] || "#aaa", textTransform: "uppercase", fontWeight: 600 }}>{res.type}</span>
                            {res.duration && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>· {res.duration}</span>}
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                              {res.url?.replace(/^https?:\/\//, "").split("/")[0]}
                            </span>
                          </div>
                        </div>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px" }}>↗</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeModule.checkpoint && (
                <section style={{
                  background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)",
                  borderRadius: "12px", padding: "18px 20px",
                }}>
                  <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 600, color: "#dc2626" }}>🏁 Checkpoint</h3>
                  {activeModule.checkpoint.practiceQuestions?.length > 0 && (
                    <>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Practice Questions</div>
                      <ol style={{ margin: "0 0 16px", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {activeModule.checkpoint.practiceQuestions.map((q, i) => (
                          <li key={i} style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5" }}>{q}</li>
                        ))}
                      </ol>
                    </>
                  )}
                  {activeModule.checkpoint.miniProject && (
                    <>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mini Project</div>
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>🛠 {activeModule.checkpoint.miniProject}</div>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <ChatButton
        roadmap={roadmap}
        currentModule={activeModule}
        currentResource={activeResource}
      />
    </div>
  );
}