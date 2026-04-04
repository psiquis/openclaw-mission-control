// Built-in cron job templates

export interface CronTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  agentId: string;
  schedule: { kind: string; expr: string };
  timezone: string;
  sessionTarget: string;
  message: string;
  deliveryMode: string;
  deliveryChannel: string;
  tags: string[];
}

export const CRON_TEMPLATES: CronTemplate[] = [
  {
    id: 'daily-backup',
    name: 'Daily Backup',
    description: 'Run daily backup of OpenClaw environment at 3:30 AM',
    category: 'backup',
    agentId: 'bill',
    schedule: { kind: 'cron', expr: '30 3 * * *' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Ejecuta la skill ola3-backup-daily',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['backup', 'daily', 'automated'],
  },
  {
    id: 'weekly-backup',
    name: 'Weekly Backup',
    description: 'Full weekly backup on Sundays at 4:00 AM',
    category: 'backup',
    agentId: 'bill',
    schedule: { kind: 'cron', expr: '0 4 * * 0' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Ejecuta la skill ola3-backup-weekly',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['backup', 'weekly', 'automated'],
  },
  {
    id: 'daily-mc-backup',
    name: 'Daily Mission Control Backup',
    description: 'Backup Mission Control source code and data daily at 3:45 AM',
    category: 'backup',
    agentId: 'bill',
    schedule: { kind: 'cron', expr: '45 3 * * *' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Ejecuta la skill ola3-backup-daily-mission-control',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['backup', 'daily', 'mission-control'],
  },
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    description: 'Generate a morning briefing summary at 8:00 AM on weekdays',
    category: 'reporting',
    agentId: 'ruben',
    schedule: { kind: 'cron', expr: '0 8 * * 1-5' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Genera un briefing matutino: estado de servicios, último backup, errores recientes, tareas pendientes.',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['reporting', 'daily', 'briefing'],
  },
  {
    id: 'health-check',
    name: 'System Health Check',
    description: 'Check system health every 6 hours: disk, memory, services, Ollama',
    category: 'monitoring',
    agentId: 'bill',
    schedule: { kind: 'cron', expr: '0 */6 * * *' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Ejecuta un healthcheck del sistema: verifica disco, memoria, servicios systemd (ollama, ollama-proxy, openclaw-gateway), y que ollama list responde correctamente. Reporta si hay problemas.',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['monitoring', 'health', 'automated'],
  },
  {
    id: 'weekly-cleanup',
    name: 'Weekly Cleanup',
    description: 'Clean old logs, temp files, and session resets on Sundays at 5:00 AM',
    category: 'maintenance',
    agentId: 'bill',
    schedule: { kind: 'cron', expr: '0 5 * * 0' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Limpia archivos temporales y antiguos: sesiones .jsonl.reset.* de más de 7 días en ~/.openclaw/agents/*/sessions/, logs de más de 30 días, archivos .tmp. Reporta qué se borró y cuánto espacio se liberó.',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['maintenance', 'weekly', 'cleanup'],
  },
  {
    id: 'cyber-news',
    name: 'Cyber News Daily',
    description: 'Generate daily cybersecurity news package',
    category: 'content',
    agentId: 'elon',
    schedule: { kind: 'cron', expr: '0 7 * * 1-5' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Ejecuta la skill ola3-noticias-cyber',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['content', 'daily', 'cyber'],
  },
  {
    id: 'ollama-model-check',
    name: 'Ollama Model Update Check',
    description: 'Check for Ollama model updates weekly on Mondays',
    category: 'maintenance',
    agentId: 'bill',
    schedule: { kind: 'cron', expr: '0 6 * * 1' },
    timezone: 'Europe/Madrid',
    sessionTarget: 'isolated',
    message: 'Revisa si hay actualizaciones disponibles para los modelos de Ollama instalados. Ejecuta ollama list y compara con versiones disponibles. Reporta si hay updates.',
    deliveryMode: 'announce',
    deliveryChannel: 'telegram',
    tags: ['maintenance', 'weekly', 'ollama'],
  },
];
