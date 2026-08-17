"use client";

import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  allowAgents: string[];
  allowAgentsDetails?: Array<{ id: string; name: string; emoji: string; color: string }>;
  status: "online" | "offline";
  activeSessions: number;
}

interface AgentOrganigramaProps {
  agents: Agent[];
}

interface NodePos {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  agent: Agent;
}

const NODE_W = 160;
const NODE_H = 72;
const H_GAP = 40;
const V_GAP = 80;

export function AgentOrganigrama({ agents }: AgentOrganigramaProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (agents.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
        No agents configured
      </div>
    );
  }

  // Build parent-child relationships from allowAgents
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Determine root agents (not listed as sub of anyone)
  const childIds = new Set(agents.flatMap((a) => a.allowAgents));
  const roots = agents.filter((a) => !childIds.has(a.id));

  // Build tree: find children of each agent
  function getChildren(agentId: string): Agent[] {
    const agent = agentMap.get(agentId);
    if (!agent) return [];
    return (agent.allowAgents || []).map((id) => agentMap.get(id)).filter(Boolean) as Agent[];
  }

  // Layout algorithm: compute positions
  const positions: NodePos[] = [];

  function layoutAgent(agent: Agent, level: number, col: number): number {
    const children = getChildren(agent.id);
    let myCol = col;

    if (children.length > 0) {
      let childCol = col;
      for (const child of children) {
        childCol = layoutAgent(child, level + 1, childCol);
      }
      // Center over children
      const firstChild = positions.find((p) => p.id === children[0].id);
      const lastChild = positions.find((p) => p.id === children[children.length - 1].id);
      if (firstChild && lastChild) {
        myCol = Math.floor((firstChild.x + lastChild.x + NODE_W) / 2 - NODE_W / 2);
      } else {
        myCol = col;
      }
      return childCol;
    } else {
      myCol = col;
      positions.push({
        id: agent.id,
        x: myCol,
        y: level * (NODE_H + V_GAP),
        width: NODE_W,
        height: NODE_H,
        agent,
      });
      return col + NODE_W + H_GAP;
    }
  }

  // Two-pass: first layout leaves, then parents
  // Simpler: DFS with position accumulator
  const leafXCounter = { val: 0 };

  function layoutDFS(agent: Agent, level: number): void {
    const children = getChildren(agent.id);

    if (children.length === 0) {
      positions.push({
        id: agent.id,
        x: leafXCounter.val,
        y: level * (NODE_H + V_GAP),
        width: NODE_W,
        height: NODE_H,
        agent,
      });
      leafXCounter.val += NODE_W + H_GAP;
    } else {
      for (const child of children) {
        layoutDFS(child, level + 1);
      }
      // Center parent over its children
      const childPositions = children.map((c) => positions.find((p) => p.id === c.id)).filter(Boolean) as NodePos[];
      const leftX = Math.min(...childPositions.map((p) => p.x));
      const rightX = Math.max(...childPositions.map((p) => p.x + p.width));
      const centerX = leftX + (rightX - leftX) / 2 - NODE_W / 2;
      positions.push({
        id: agent.id,
        x: centerX,
        y: level * (NODE_H + V_GAP),
        width: NODE_W,
        height: NODE_H,
        agent,
      });
    }
  }

  for (const root of roots) {
    layoutDFS(root, 0);
  }

  // SVG dimensions
  const minX = Math.min(...positions.map((p) => p.x));
  const maxX = Math.max(...positions.map((p) => p.x + p.width));
  const maxY = Math.max(...positions.map((p) => p.y + p.height));
  const padding = 40;
  const svgW = maxX - minX + padding * 2;
  const svgH = maxY + padding * 2;

  // Offset all positions by padding - minX
  const offsetX = padding - minX;
  const offsetY = padding;

  // Build edges (parent → children)
  const edges: Array<{ from: NodePos; to: NodePos }> = [];
  for (const pos of positions) {
    const children = getChildren(pos.id);
    for (const child of children) {
      const childPos = positions.find((p) => p.id === child.id);
      if (childPos) {
        edges.push({ from: pos, to: childPos });
      }
    }
  }

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", padding: "1rem" }}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ fontFamily: "var(--font-heading, sans-serif)", display: "block", margin: "0 auto", maxWidth: "100%" }}
      >
        {/* Edges */}
        {edges.map(({ from, to }, i) => {
          const x1 = from.x + offsetX + from.width / 2;
          const y1 = from.y + offsetY + from.height;
          const x2 = to.x + offsetX + to.width / 2;
          const y2 = to.y + offsetY;
          const midY = (y1 + y2) / 2;

          const isHovered = hoveredId === from.id || hoveredId === to.id;

          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              fill="none"
              stroke={isHovered ? "var(--accent)" : "var(--border)"}
              strokeWidth={isHovered ? 2 : 1.5}
              opacity={isHovered ? 1 : 0.5}
              strokeDasharray={isHovered ? "none" : "4,4"}
              style={{ transition: "all 0.2s" }}
            />
          );
        })}

        {/* Nodes */}
        {positions.map((pos) => {
          const x = pos.x + offsetX;
          const y = pos.y + offsetY;
          const agent = pos.agent;
          const isHovered = hoveredId === agent.id;
          const isOnline = agent.status === "online";

          return (
            <g
              key={pos.id}
              onMouseEnter={() => setHoveredId(agent.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Card background */}
              <rect
                x={x}
                y={y}
                width={pos.width}
                height={pos.height}
                rx={10}
                ry={10}
                fill={isHovered ? `${agent.color}22` : "var(--card)"}
                stroke={isHovered ? agent.color : "var(--border)"}
                strokeWidth={isHovered ? 2 : 1}
                style={{ transition: "all 0.2s", filter: isHovered ? "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" : "none" }}
              />

              {/* Left color bar */}
              <rect
                x={x}
                y={y + 6}
                width={3}
                height={pos.height - 12}
                rx={2}
                fill={agent.color}
              />

              {/* Emoji */}
              <text
                x={x + 22}
                y={y + pos.height / 2 + 6}
                fontSize={10}
                fontWeight={600}
                fill="var(--text-secondary)"
                textAnchor="middle"
              >
                {(agent.name || "").slice(0, 2).toUpperCase()}
              </text>

              {/* Name */}
              <text
                x={x + 42}
                y={y + pos.height / 2 - 6}
                fill="var(--text-primary)"
                fontSize={12}
                fontWeight={600}
                fontFamily="var(--font-heading, sans-serif)"
              >
                {agent.name.length > 14 ? agent.name.slice(0, 13) + "…" : agent.name}
              </text>

              {/* Model */}
              <text
                x={x + 42}
                y={y + pos.height / 2 + 8}
                fill="var(--text-muted)"
                fontSize={9}
              >
                {agent.model.split("/").pop()?.slice(0, 18) || ""}
              </text>

              {/* Status dot */}
              <circle
                cx={x + pos.width - 10}
                cy={y + 10}
                r={4}
                fill={isOnline ? "#4ade80" : "#6b7280"}
              />

              {/* Sessions badge (if active) */}
              {agent.activeSessions > 0 && (
                <g>
                  <circle cx={x + pos.width - 10} cy={y + pos.height - 10} r={8} fill="rgba(255,59,48,0.15)" stroke="var(--accent)" strokeWidth={1} />
                  <text x={x + pos.width - 10} y={y + pos.height - 7} fontSize={8} fill="var(--accent)" textAnchor="middle" fontWeight={700}>
                    {agent.activeSessions}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
        <span>● Online</span>
        <span style={{ color: "#6b7280" }}>● Offline</span>
        <span>--- allows communication</span>
      </div>
    </div>
  );
}
