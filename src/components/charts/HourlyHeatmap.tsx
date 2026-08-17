"use client";

import { useState } from "react";

interface HourData {
  hour: number;
  day: number;
  count: number;
}

interface HourlyHeatmapProps {
  data: HourData[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// CSS variable values
const THEME = {
  accent: "#FF3B30",
  border: "#2A2A2A",
  card: "#1A1A1A",
  textPrimary: "#FFFFFF",
  textSecondary: "#8A8A8A",
  textMuted: "#525252",
};

// Generate intensity colors based on accent
function getIntensityStyle(count: number, max: number): React.CSSProperties {
  if (count === 0) {
    return { backgroundColor: THEME.border };
  }
  const intensity = count / max;
  const opacity = 0.2 + intensity * 0.8; // Range from 0.2 to 1.0
  return { backgroundColor: THEME.accent, opacity };
}

export function HourlyHeatmap({ data }: HourlyHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
    text: string;
  }>({ show: false, x: 0, y: 0, text: "" });

  // Create a map for quick lookup
  const dataMap = new Map<string, number>();
  data.forEach((item) => {
    dataMap.set(`${item.day}-${item.hour}`, item.count);
  });

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const handleMouseEnter = (
    e: React.MouseEvent,
    day: number,
    hour: number,
    count: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      show: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      text: `${DAYS[day]} ${hour}:00 - ${count} activities`,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, text: "" });
  };

  return (
    <div className="relative">
      {/* Hour labels */}
      <div className="flex ml-12 mb-1">
        {HOURS.filter((h) => h % 3 === 0).map((hour) => (
          <div
            key={hour}
            className="text-xs"
            style={{ width: "36px", color: THEME.textMuted }}
          >
            {hour}:00
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="flex flex-col gap-1">
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="flex items-center gap-1">
            <span
              className="w-10 text-xs text-right pr-2"
              style={{ color: THEME.textSecondary }}
            >
              {day}
            </span>
            <div className="flex gap-0.5">
              {HOURS.map((hour) => {
                const count = dataMap.get(`${dayIndex}-${hour}`) || 0;
                return (
                  <div
                    key={hour}
                    className="w-3 h-3 rounded-sm cursor-pointer transition-transform"
                    style={getIntensityStyle(count, maxCount)}
                    onMouseEnter={(e) =>
                      handleMouseEnter(e, dayIndex, hour, count)
                    }
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="fixed z-50 px-2 py-1 text-xs rounded shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
            backgroundColor: THEME.card,
            color: THEME.textPrimary,
            border: `1px solid ${THEME.border}`,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="text-xs" style={{ color: THEME.textMuted }}>Less</span>
        <div className="flex gap-0.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: THEME.border }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: THEME.accent, opacity: 0.3 }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: THEME.accent, opacity: 0.5 }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: THEME.accent, opacity: 0.75 }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: THEME.accent, opacity: 1 }}
          />
        </div>
        <span className="text-xs" style={{ color: THEME.textMuted }}>More</span>
      </div>
    </div>
  );
}
