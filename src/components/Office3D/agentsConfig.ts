/**
 * Office 3D — Agent Configuration
 *
 * This file defines the visual layout of agents in the 3D office.
 * Names, emojis and roles are loaded at runtime from the OpenClaw API
 * (/api/agents → openclaw.json), so you only need to set positions and colors here.
 *
 * Agent IDs correspond to workspace directory suffixes:
 *   id: "main"     → workspace/          (main agent)
 *   id: "studio"   → workspace-studio/
 *   id: "infra"    → workspace-infra/
 *   etc.
 *
 * Add, remove or reposition agents to match your own OpenClaw setup.
 */

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number]; // x, y, z
  color: string;
  role: string;
}

export const AGENTS: AgentConfig[] = [
  {
    id: "ruben",
    name: "Rubén",
    emoji: "🧠",
    position: [0, 0, 0],
    color: "#FFCC00",
    role: "CEO / Orquestador",
  },
  {
    id: "bill",
    name: "BILL",
    emoji: "🖥️",
    position: [-4, 0, -3],
    color: "#4CAF50",
    role: "CIO / Infraestructura",
  },
  {
    id: "elon",
    name: "ELON",
    emoji: "🚀",
    position: [4, 0, -3],
    color: "#E91E63",
    role: "I+D / Automatización",
  },
  {
    id: "quin",
    name: "QUIN",
    emoji: "⚡",
    position: [-4, 0, 3],
    color: "#FF9800",
    role: "Ejecución IA",
  },
  {
    id: "trump",
    name: "TRUMP",
    emoji: "📢",
    position: [4, 0, 3],
    color: "#0077B5",
    role: "Marketing / Social",
  },
  {
    id: "warren",
    name: "WARREN",
    emoji: "💰",
    position: [0, 0, 6],
    color: "#9C27B0",
    role: "CFO / Optimización",
  },
];

export type AgentStatus = "idle" | "working" | "thinking" | "error";

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: string;
  model?: string; // opus, sonnet, haiku
  tokensPerHour?: number;
  tasksInQueue?: number;
  uptime?: number; // days
}
