"use client";

import { useEffect, useState } from "react";
import { ActivityLineChart } from "@/components/charts/ActivityLineChart";
import { ActivityPieChart } from "@/components/charts/ActivityPieChart";
import { HourlyHeatmap } from "@/components/charts/HourlyHeatmap";
import { SuccessRateGauge } from "@/components/charts/SuccessRateGauge";
import { BarChart3, TrendingUp, Clock, Target } from "lucide-react";

interface AnalyticsData {
  byDay: { date: string; count: number }[];
  byType: { type: string; count: number }[];
  byHour: { hour: number; day: number; count: number }[];
  successRate: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="p-4 md:p-8 flex items-center justify-center min-h-screen"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <span style={{ color: "var(--text-secondary)" }}>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 md:p-8" style={{ backgroundColor: "var(--background)" }}>
        <p style={{ color: "var(--error)" }}>Failed to load analytics data</p>
      </div>
    );
  }

  const totalThisWeek = data.byDay.reduce((sum, d) => sum + d.count, 0);
  const mostActiveDay = data.byDay.reduce(
    (max, d) => (d.count > max.count ? d : max),
    data.byDay[0]
  )?.date || "-";

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <div className="mb-4 md:mb-8">
        <h1
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
        >
           Analytics
        </h1>
        <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
          Insights and trends from agent activity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <div
          className="rounded-xl p-3 md:p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Total This Week</p>
          <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {totalThisWeek}
          </p>
        </div>
        <div
          className="rounded-xl p-3 md:p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Most Active Day</p>
          <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--accent)" }}>
            {mostActiveDay}
          </p>
        </div>
        <div
          className="rounded-xl p-3 md:p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Top Activity Type</p>
          <p className="text-xl md:text-2xl font-bold capitalize" style={{ color: "var(--info)" }}>
            {data.byType[0]?.type || "-"}
          </p>
        </div>
        <div
          className="rounded-xl p-3 md:p-4"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Success Rate</p>
          <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--success)" }}>
            {data.successRate.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Activity Over Time */}
        <div
          className="rounded-xl p-4 md:p-6"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2
              className="text-lg md:text-xl font-bold"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
            >
              Activity Over Time
            </h2>
          </div>
          <ActivityLineChart data={data.byDay} />
        </div>

        {/* Activity by Type */}
        <div
          className="rounded-xl p-4 md:p-6"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <BarChart3 className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2
              className="text-lg md:text-xl font-bold"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
            >
              Activity by Type
            </h2>
          </div>
          <ActivityPieChart data={data.byType} />
        </div>

        {/* Hourly Heatmap */}
        <div
          className="rounded-xl p-4 md:p-6"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <Clock className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2
              className="text-lg md:text-xl font-bold"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
            >
              Activity by Hour
            </h2>
          </div>
          <HourlyHeatmap data={data.byHour} />
        </div>

        {/* Success Rate Gauge */}
        <div
          className="rounded-xl p-4 md:p-6"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <Target className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2
              className="text-lg md:text-xl font-bold"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
            >
              Success Rate
            </h2>
          </div>
          <SuccessRateGauge rate={data.successRate} />
        </div>
      </div>
    </div>
  );
}
