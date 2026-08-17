"use client";

import { useState, useEffect, useCallback } from "react";
import { FileBarChart, FileText, RefreshCw, Clock, HardDrive } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

interface Report {
  name: string;
  path: string;
  title: string;
  type: string;
  size: number;
  modified: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadContent = useCallback(async (path: string) => {
    try {
      setIsLoadingContent(true);
      const res = await fetch(`/api/reports?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("Failed to load report");
      const data = await res.json();
      setContent(data.content);
    } catch (err) {
      console.error(err);
      setContent("# Error\n\nFailed to load report content.");
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const handleSelect = useCallback(
    (report: Report) => {
      setSelectedPath(report.path);
      loadContent(report.path);
    },
    [loadContent]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Auto-select first report
  useEffect(() => {
    if (reports.length > 0 && !selectedPath) {
      handleSelect(reports[0]);
    }
  }, [reports, selectedPath, handleSelect]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 md:p-4"
        style={{
          backgroundColor: "var(--card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <FileBarChart className="w-5 h-5 md:w-6 md:h-6" style={{ color: "var(--accent)" }} />
          <div>
            <h1
              className="text-lg md:text-xl font-bold"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Reports
            </h1>
            <p className="text-xs md:text-sm hidden sm:block" style={{ color: "var(--text-secondary)" }}>
              Analysis reports and insights
            </p>
          </div>
        </div>
        <button
          onClick={loadReports}
          className="p-2 rounded-lg transition-colors hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
          title="Refresh reports"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Main content - split layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Report list */}
        <div
          className="w-full md:w-80 lg:w-96 overflow-y-auto flex-shrink-0"
          style={{
            backgroundColor: "var(--card)",
            borderRight: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            className="p-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h2
              className="text-sm font-semibold tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              {isLoading ? "Loading..." : `${reports.length} Reports`}
            </h2>
          </div>

          {!isLoading && reports.length === 0 && (
            <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>
              <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No reports found</p>
              <p className="text-xs mt-1">
                Reports matching *-analysis-* or *-report-* patterns in memory/ will appear here
              </p>
            </div>
          )}

          <div className="p-2 space-y-2">
            {reports.map((report) => (
              <button
                key={report.path}
                onClick={() => handleSelect(report)}
                className="w-full text-left rounded-lg p-3 transition-all"
                style={{
                  backgroundColor:
                    selectedPath === report.path
                      ? "var(--accent)"
                      : "var(--card-elevated, var(--background))",
                  border: `1px solid ${
                    selectedPath === report.path
                      ? "var(--accent)"
                      : "var(--border)"
                  }`,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (selectedPath !== report.path) {
                    e.currentTarget.style.borderColor = "var(--accent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPath !== report.path) {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <FileText
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    style={{
                      color:
                        selectedPath === report.path
                          ? "var(--text-primary)"
                          : "var(--accent)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-medium text-sm truncate"
                      style={{
                        color:
                          selectedPath === report.path
                            ? "var(--text-primary)"
                            : "var(--text-primary)",
                      }}
                    >
                      {report.title}
                    </p>
                    <div
                      className="flex items-center gap-3 mt-1 text-xs"
                      style={{
                        color:
                          selectedPath === report.path
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        opacity: selectedPath === report.path ? 0.8 : 1,
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(report.modified)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatSize(report.size)}
                      </span>
                    </div>
                    <span
                      className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                          selectedPath === report.path
                            ? "rgba(255,255,255,0.15)"
                            : "var(--background)",
                        color:
                          selectedPath === report.path
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {report.type}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview panel */}
        <div
          className="flex-1 min-w-0 min-h-0"
          style={{ backgroundColor: "var(--background)" }}
        >
          {selectedPath ? (
            isLoadingContent ? (
              <div
                className="flex items-center justify-center h-full"
                style={{ color: "var(--text-secondary)" }}
              >
                Loading report...
              </div>
            ) : (
              <MarkdownPreview content={content} />
            )
          ) : (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: "var(--text-muted)" }}
            >
              <div className="text-center">
                <FileBarChart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Select a report to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
