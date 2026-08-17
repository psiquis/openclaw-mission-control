"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, Edit3, RefreshCw, Brain } from "lucide-react";
import { FileTree, FileNode } from "@/components/FileTree";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { DreamsPanel } from "@/components/DreamsPanel";

type ViewMode = "edit" | "preview";

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

export default function MemoryPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasUnsavedChanges = content !== originalContent;

  // Load workspaces
  useEffect(() => {
    fetch("/api/files/workspaces")
      .then((res) => res.json())
      .then((data) => {
        setWorkspaces(data.workspaces || []);
        if (data.workspaces.length > 0) {
          setSelectedWorkspace(data.workspaces[0].id);
        }
      })
      .catch(() => setWorkspaces([]));
  }, []);

  const loadFileTree = useCallback(async (workspace: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/files?workspace=${encodeURIComponent(workspace)}`);
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError("Failed to load file tree");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFile = useCallback(async (workspace: string, path: string) => {
    try {
      setError(null);
      const res = await fetch(
        `/api/files?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}`
      );
      if (!res.ok) throw new Error("Failed to load file");
      const data = await res.json();
      setContent(data.content);
      setOriginalContent(data.content);
    } catch (err) {
      setError("Failed to load file");
      console.error(err);
    }
  }, []);

  const saveFile = useCallback(async () => {
    if (!selectedWorkspace || !selectedPath) return;
    const res = await fetch("/api/files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: selectedWorkspace, path: selectedPath, content }),
    });
    if (!res.ok) throw new Error("Failed to save file");
    setOriginalContent(content);
  }, [selectedWorkspace, selectedPath, content]);

  const handleSelectFile = useCallback(
    async (path: string) => {
      if (hasUnsavedChanges) {
        const confirmed = window.confirm("You have unsaved changes. Discard them?");
        if (!confirmed) return;
      }
      setSelectedPath(path);
      if (selectedWorkspace) await loadFile(selectedWorkspace, path);
    },
    [hasUnsavedChanges, selectedWorkspace, loadFile]
  );

  const handleWorkspaceSelect = (workspaceId: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmed) return;
    }
    setSelectedWorkspace(workspaceId);
    setSelectedPath(null);
    setContent("");
    setOriginalContent("");
  };

  useEffect(() => {
    if (selectedWorkspace) loadFileTree(selectedWorkspace);
  }, [selectedWorkspace, loadFileTree]);

  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      const memoryMd = files.find((f) => f.name === "MEMORY.md" && f.type === "file");
      const firstFile = memoryMd || files.find((f) => f.type === "file");
      if (firstFile) handleSelectFile(firstFile.path);
    }
  }, [files, selectedPath, handleSelectFile]);

  const selectedWorkspaceData = workspaces.find((w) => w.id === selectedWorkspace);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Page header */}
      <div style={{ padding: "24px 24px 16px 24px", flexShrink: 0 }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: 700,
            
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          Memory Browser
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
          Ver y editar archivos de memoria de los agentes
        </p>
      </div>

      <DreamsPanel />

      {/* Two-column layout */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          borderTop: "1px solid var(--border)",
        }}
      >
        {/* ── LEFT SIDEBAR: Workspace list ────────────────────────────────── */}
        <aside
          style={{
            width: "220px",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            padding: "16px 0",
            backgroundColor: "var(--surface, var(--card))",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              padding: "0 16px 8px",
              
            }}
          >
            Workspaces
          </p>

          {workspaces.map((workspace) => {
            const isSelected = selectedWorkspace === workspace.id;
            return (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceSelect(workspace.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 16px",
                  background: isSelected ? "var(--accent-soft)" : "transparent",
                  border: "none",
                  borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "var(--surface-hover, rgba(255,255,255,0.05))";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "13px",
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "var(--accent)" : "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {workspace.name}
                  </div>
                  {workspace.agentName && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {workspace.agentName}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selectedWorkspace && selectedWorkspaceData ? (
            <>
              {/* Toolbar bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--surface, var(--card))",
                  flexShrink: 0,
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Brain style={{ width: "16px", height: "16px", color: "var(--accent)" }} />
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {selectedWorkspaceData.name}
                  </span>
                  {selectedPath && (
                    <>
                      <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>/</span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "300px",
                        }}
                      >
                        {selectedPath}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {/* Refresh */}
                  <button
                    onClick={() => selectedWorkspace && loadFileTree(selectedWorkspace)}
                    title="Refresh"
                    style={{
                      padding: "5px 7px",
                      borderRadius: "6px",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      transition: "all 120ms ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <RefreshCw size={14} />
                  </button>

                  {/* View toggle */}
                  <div
                    style={{
                      display: "flex",
                      backgroundColor: "var(--bg)",
                      borderRadius: "6px",
                      padding: "3px",
                      gap: "2px",
                    }}
                  >
                    <button
                      onClick={() => setViewMode("preview")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "5px 10px",
                        borderRadius: "4px",
                        backgroundColor: viewMode === "preview" ? "var(--accent)" : "transparent",
                        color: viewMode === "preview" ? "var(--bg, #111)" : "var(--text-muted)",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                        transition: "all 120ms ease",
                      }}
                    >
                      <Eye size={13} />
                      Preview
                    </button>
                    <button
                      onClick={() => setViewMode("edit")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "5px 10px",
                        borderRadius: "4px",
                        backgroundColor: viewMode === "edit" ? "var(--accent)" : "transparent",
                        color: viewMode === "edit" ? "var(--bg, #111)" : "var(--text-muted)",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                        transition: "all 120ms ease",
                      }}
                    >
                      <Edit3 size={13} />
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* File tree + editor */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* File tree */}
                <div
                  style={{
                    width: "230px",
                    flexShrink: 0,
                    borderRight: "1px solid var(--border)",
                    overflowY: "auto",
                  }}
                >
                  {isLoading ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                      Loading...
                    </div>
                  ) : error && files.length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--negative)" }}>
                      {error}
                    </div>
                  ) : (
                    <FileTree files={files} selectedPath={selectedPath} onSelect={handleSelectFile} />
                  )}
                </div>

                {/* Editor / Preview */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    backgroundColor: "var(--bg)",
                    overflow: "hidden",
                  }}
                >
                  {selectedPath ? (
                    <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                      {viewMode === "edit" ? (
                        <MarkdownEditor
                          content={content}
                          onChange={setContent}
                          onSave={saveFile}
                          hasUnsavedChanges={hasUnsavedChanges}
                        />
                      ) : (
                        <MarkdownPreview content={content} />
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <Brain style={{ width: "64px", height: "64px", margin: "0 auto 16px", opacity: 0.3 }} />
                        <p style={{ fontSize: "14px" }}>Selecciona un archivo para ver o editar</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              Selecciona un workspace
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
