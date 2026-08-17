# 🦞 Mission Control - Roadmap

## ✅ Shipped in v0.4.0 (Agosto 2026)

- Rediseno visual completo ("pro-minimal") en toda la app
- Telemetria real del gateway en Settings y System (via `openclaw status --json`)
- Tarjeta de Auditoria de Seguridad (`openclaw security audit --json`)
- Quick Actions funcionales (restart gateway, tail logs) con scoping systemd correcto
- Pagina Workflows / Automatizaciones (solo OpenClaw, sin n8n)
- Flujo de cambio de contrasena corregido
- Branding 100% configurable via `.env.local`, sin nada hardcodeado a un despliegue especifico

---

## Fase 1: Fundamentos (Semana 1)
> Mejorar lo que ya existe y añadir datos reales

### 1.1 Activity Logger Real
- [ ] Crear endpoint POST `/api/activities` para que el agente registre acciones
- [ ] Hook en OpenClaw para loguear automáticamente cada tool call
- [ ] Campos: timestamp, type, description, status, duration, tokens_used
- [ ] Retención: últimos 30 días

### 1.2 Integración con Cron Real
- [ ] Leer cron jobs reales de OpenClaw (`cron list`)
- [ ] Mostrar en calendario con próximas ejecuciones
- [ ] Historial de ejecuciones pasadas

### 1.3 Stats Dashboard
- [ ] Contador de actividades por día/semana
- [ ] Tipos de acciones más frecuentes
- [ ] Tasa de éxito/error

---

## Fase 2: Memory & Files (Semana 2)
> Gestión visual del workspace

### 2.1 Memory Browser
- [ ] Vista árbol de `memory/*.md` y archivos principales
- [ ] Editor markdown con preview
- [ ] Crear/renombrar/eliminar archivos
- [ ] Búsqueda dentro de archivos

### 2.2 File Browser
- [ ] Explorador del workspace completo
- [ ] Preview de archivos (código, markdown, JSON)
- [ ] Descargar archivos
- [ ] Upload de archivos

### 2.3 MEMORY.md Viewer
- [ ] Vista especial para MEMORY.md con secciones colapsables
- [ ] Edición inline
- [ ] Historial de cambios (git log)

---

## Fase 3: Cron Manager (Semana 3)
> Control total de tareas programadas

### 3.1 CRUD de Cron Jobs
- [x] Listar todos los jobs con estado (ya existía)
- [ ] Crear nuevo job con form visual (CronJobModal existe pero no está wired up al API)
- [ ] Editar job existente
- [x] Eliminar job (con confirmación)
- [x] Activar/desactivar job

### 3.2 Cron Builder Visual
- [ ] Selector de frecuencia: diario, semanal, mensual, custom
- [ ] Preview de próximas 5 ejecuciones
- [ ] Selector de timezone
- [ ] Templates predefinidos

### 3.3 Historial de Ejecuciones
- [x] ~~Re-ejecutar manualmente~~ → **"Run Now" button** en CronJobCard (llama a `POST /api/cron/run`)
- [x] **Run History inline** → botón History en CronJobCard, llama a `GET /api/cron/runs?id=<id>`
- [ ] Filtrar historial por fecha, estado
- [ ] Log con output completo

### 3.4 Weekly Timeline View ✅ (nuevo — 2026-02-19)
- [x] Vista tipo calendario de 7 días
- [x] Eventos de cron posicionados por día con hora exacta
- [x] Jobs de intervalo mostrados como "recurring" con dashed border
- [x] Leyenda de colores por job
- [x] Toggle Cards / Timeline en header
- [x] Componente: `CronWeeklyTimeline.tsx`
- [x] Nuevas rutas API: `POST /api/cron/run`, `GET /api/cron/runs`

---

## Fase 4: Analytics (Semana 4)
> Visualización de datos

### 4.1 Gráficas de Uso
- [ ] Actividad por hora del día (heatmap)
- [ ] Tokens consumidos por día (line chart)
- [ ] Tipos de tareas (pie chart)
- [ ] Tendencia semanal

### 4.2 Cost Tracking
- [ ] Estimación de coste por modelo
- [ ] Coste acumulado diario/mensual
- [ ] Alertas de gasto (opcional)

### 4.3 Performance Metrics
- [ ] Tiempo promedio de respuesta
- [ ] Tasa de éxito por tipo de tarea
- [ ] Uptime del agente

---

## Fase 5: Comunicación (Semana 5)
> Interacción bidireccional

### 5.1 Command Terminal
- [ ] Input para enviar mensajes/comandos al agente
- [ ] Output en tiempo real de respuesta
- [ ] Historial de comandos
- [ ] Shortcuts para comandos frecuentes

### 5.2 Notifications Log
- [ ] Lista de mensajes enviados por canal (Telegram, etc.)
- [ ] Filtrar por fecha, canal, tipo
- [ ] Preview del mensaje
- [ ] Estado de entrega

### 5.3 Session History ✅ (nuevo — 2026-02-21)
- [x] **Lista de sesiones** → todas las sesiones de OpenClaw (main, cron, subagent, chats)
- [x] **Tipos visuales** → badges con emoji 🦞 Main / 🕐 Cron / 🤖 Sub-agent / 💬 Direct
- [x] **Token counter** → total tokens + barra de contexto (% usado) con color-coding
- [x] **Model badge** → modelo mostrado (Sonnet 4.5, Opus 4.6, etc.)
- [x] **Age display** → "2 hours ago", "3 days ago" con date-fns
- [x] **Transcript viewer** → slide-in panel con mensajes del JSONL real
- [x] **Bubbles UI** → user/assistant/tool_use/tool_result con diferentes estilos
- [x] **Filter tabs** → All / Main / Cron / Sub-agents / Chats con contador
- [x] **Búsqueda** → filtro por key/model
- [x] **Stats cards** → Total sessions, Total tokens, Cron runs, Models used
- [x] **Sidebar + Dock** → añadido a navegación (icono History)
- **Archivos:**
  - NEW: `src/app/api/sessions/route.ts`
  - NEW: `src/app/(dashboard)/sessions/page.tsx`
  - MODIFIED: `src/components/Sidebar.tsx` (añadida entrada Sessions)
  - MODIFIED: `src/components/TenacitOS/Dock.tsx` (añadida entrada Sessions)

### 5.4 Notifications System ✅ (nuevo — 2026-02-20)
- [x] **API de notificaciones** → `GET/POST/PATCH/DELETE /api/notifications`
- [x] **NotificationDropdown component** → Bell icon en TopBar con dropdown funcional
- [x] **Unread count badge** → Contador de notificaciones no leídas
- [x] **Notificación types** → info, success, warning, error con iconos y colores
- [x] **Mark as read/unread** → Individual o todas
- [x] **Delete notifications** → Individual o clear all read
- [x] **Links** → Notificaciones pueden tener links a páginas internas
- [x] **Auto-refresh** → Poll cada 30 segundos
- [x] **Integración con cron** → Cron Run Now genera notificación
- [x] **Storage** → JSON file en `data/notifications.json` (hasta 100 notificaciones)
- **Archivos:**
  - NEW: `src/app/api/notifications/route.ts`
  - NEW: `src/components/NotificationDropdown.tsx`
  - MODIFIED: `src/components/TenacitOS/TopBar.tsx`
  - MODIFIED: `src/app/api/cron/run/route.ts` (integración)

---

## Fase 6: Configuración (Semana 6)
> Admin del sistema

### 6.1 Skills Manager
- [ ] Lista de skills instalados
- [ ] Ver SKILL.md de cada uno
- [ ] Activar/desactivar
- [ ] Instalar desde ClawHub
- [ ] Actualizar skills

### 6.2 Integration Status
- [ ] Estado de conexiones (Twitter, Gmail, etc.)
- [ ] Última actividad por integración
- [ ] Test de conectividad
- [ ] Reautenticar si necesario

### 6.3 Config Editor
- [ ] Ver configuración actual de OpenClaw
- [ ] Editar valores seguros
- [ ] Validación antes de guardar
- [ ] Reiniciar gateway si necesario

---

## Fase 7: Real-time (Semana 7)
> WebSockets y notificaciones live

### 7.1 Live Activity Stream
- [ ] WebSocket connection
- [ ] Updates en tiempo real del activity feed
- [ ] Indicador "El agente está trabajando..."
- [ ] Toast notifications

### 7.2 System Status
- [ ] Heartbeat del agente
- [ ] CPU/memoria del VPS
- [ ] Cola de tareas pendientes

---

## Fase 8: The Office 3D 🏢 (Semanas 8-10)
> Entorno 3D navegable que simula una oficina virtual donde trabajan los agentes

**Ver spec completa:** `ROADMAP-OFFICE-3D.md`

### 8.1 MVP - Oficina Básica (Semana 8)
- [ ] Sala 3D con React Three Fiber + 6 escritorios
- [ ] Navegación WASD + mouse (fly mode)
- [ ] Monitors mostrando estado: Working/Idle/Error
- [ ] Click en escritorio → panel lateral con activity feed
- [ ] Iluminación básica (día/noche)
- [ ] Avatares simples (cubo/esfera con emoji del agente)

### 8.2 Interactions & Ambient (Semana 9)
- [ ] Avatares animados (tecleando, pensando, error)
- [ ] Sub-agents aparecen como "visitantes" en la oficina
- [ ] Trail visual entre parent y sub-agent
- [ ] Efectos visuales (partículas success, humo error, beam heartbeat)
- [ ] Sonido ambiental toggleable (teclas, notificaciones, lofi)
- [ ] Click en objetos (archivador→Memory, pizarra→Roadmap, café→Mood)

### 8.3 Multi-Floor Building (Semana 10)
- [ ] 4 plantas navegables con ascensor:
  - Planta 1: Main Office (agentes principales)
  - Planta 2: Server Room (DBs, VPS, integrations)
  - Planta 3: Archive (logs, memories históricas)
  - Azotea: Control Tower (dashboard gigante)
- [ ] Customization: temas (modern, retro, cyberpunk, matrix)
- [ ] Modos especiales (Focus, God Mode, Cinematic)

**Datos en tiempo real:**
- `/api/agents/status` - estado de cada agente
- `/api/activities` - activity feed
- `/api/subagents` - sub-agentes activos
- Polling cada 2-5 segundos

---

## Fase 9: Agent Intelligence (Semana 11)
> Features experimentales y visualizaciones avanzadas (complementan "The Office")

### 9.1 Agent Mood Dashboard
- [ ] Widget de "estado de ánimo" basado en métricas recientes
- [ ] Indicadores visuales: productivo, ocupado, idle, frustrado (muchos errores)
- [ ] Streak counter: días consecutivos sin errores críticos
- [ ] "Energy level" basado en tokens/hora
- [ ] Emoji animado que cambia según el estado

### 9.2 Token Economics
- [ ] Vista detallada de consumo por modelo (Opus, Sonnet, Haiku, etc.)
- [ ] Breakdown: input tokens vs output tokens vs cache
- [ ] Comparativa: "Hoy vs ayer", "Esta semana vs la pasada"
- [ ] Proyección de gasto mensual
- [ ] Top 5 tareas que más tokens consumen
- [ ] Efficiency score: output útil / tokens totales

### 9.3 Knowledge Graph Viewer
- [ ] Visualización de conceptos/entidades en MEMORY.md y brain
- [ ] Grafo interactivo con nodes y links
- [ ] Click en un nodo → muestra snippets relacionados
- [ ] Clustering por temas
- [ ] Búsqueda visual
- [ ] Export a imagen

### 9.4 Quick Actions Hub
- [ ] Panel de botones para acciones frecuentes:
  - Backup workspace now
  - Clear temp files
  - Test all integrations
  - Re-authorize expired tokens
  - Git status all repos
  - Restart Gateway
  - Flush message queue
- [ ] Status de cada acción (last run, next scheduled)
- [ ] One-click execution con confirmación

### 9.5 Model Playground
- [ ] Input un prompt
- [ ] Seleccionar múltiples modelos para comparar
- [ ] Ver respuestas lado a lado
- [ ] Mostrar tokens/coste/tiempo de cada uno
- [ ] Guardar experimentos
- [ ] Share results (copy link)

### 9.6 Smart Suggestions Engine
- [ ] Analiza patrones de uso
- [ ] Sugiere optimizaciones:
  - "Usas mucho Opus para tareas simples, prueba Sonnet"
  - "Muchos errores en cron X, revisar configuración"
  - "Heartbeats muy frecuentes, considera reducir intervalo"
  - "Token usage alto en horario Y, programar tareas pesadas en horario valle"
- [ ] Tarjetas de sugerencia con botón "Apply" o "Dismiss"
- [ ] Learn from dismissals

---

## Fase 10: Sub-Agent Orchestra (Semana 12)
> Gestión y visualización de multi-agent workflows

### 10.1 Sub-Agent Dashboard
- [ ] Lista de sub-agentes activos en tiempo real
- [ ] Estado: running, waiting, completed, failed
- [ ] Task description y progreso
- [ ] Modelo usado
- [ ] Tokens consumidos por cada uno
- [ ] Timeline de spawns/completions

### 10.2 Agent Communication Graph
- [ ] Visualización de mensajes entre main agent y sub-agents
- [ ] Flow diagram tipo Sankey o network graph
- [ ] Ver contenido de mensajes al hacer click
- [ ] Filtrar por sesión, fecha, tipo

### 10.3 Multi-Agent Orchestration
- [ ] Crear workflows visuales de múltiples agentes
- [ ] Drag & drop tasks → auto-spawn agents
- [ ] Dependencies entre tasks
- [ ] Parallel vs sequential execution
- [ ] Template workflows guardables

---

## Fase 11: Advanced Visualizations (Semana 13)
> Porque los dashboards cool tienen gráficas cool

### 11.1 3D Workspace Explorer
- [ ] Vista 3D del árbol de archivos
- [ ] Tamaño de nodos = tamaño de archivo
- [ ] Color = tipo de archivo
- [ ] Navigate con mouse
- [ ] Click → preview/edit
- [ ] Wow factor 📈

### 11.2 Heatmaps Interactivos
- [ ] Actividad por hora del día (24x7 grid)
- [ ] Hover → detalles de ese slot
- [ ] Click → filtrar activity feed a ese rango
- [ ] Export a imagen

### 11.3 Sankey Diagrams
- [ ] Flow de tokens: input → cache → output
- [ ] Flow de tareas: type → status
- [ ] Flow de tiempo: hora → actividad → resultado

### 11.4 Word Cloud de Memories
- [ ] Palabras más frecuentes en MEMORY.md
- [ ] Tamaño = frecuencia
- [ ] Click en palabra → buscar en memories
- [ ] Animated on hover

---

## Fase 12: Collaboration (Semana 14)
> Share y trabajo en equipo

### 12.1 Shareable Reports
- [ ] Generar report de actividad semanal/mensual
- [ ] Export a PDF
- [ ] Share link público (read-only)
- [ ] Custom date ranges

### 12.2 Team Dashboard (futuro)
- [ ] Multi-user support
- [ ] Ver actividad de otros agentes
- [ ] Compare performance
- [ ] Shared memory bank

---

## Stack Técnico

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 16 + App Router + React 19 |
| Styling | Tailwind v4 (latest) |
| Charts | Recharts (básicos) + D3.js (avanzados) |
| Editor | Monaco Editor (code) + TipTap (markdown) |
| Real-time | Server-Sent Events (SSE) o Socket.io |
| 3D Graphics | Three.js o React Three Fiber |
| Graphs/Networks | Cytoscape.js o Vis.js |
| Animations | Framer Motion |
| Storage | JSON files (actual) → SQLite (fase 2) → PostgreSQL (futuro multi-user) |
| AI Integration | OpenClaw API + direct model calls para suggestions |
| PDF Generation | jsPDF o Puppeteer |

---

## Prioridad Recomendada

### Tier 0: The Flagship 🚀
**Fase 8: The Office 3D** - Entorno 3D inmersivo donde visualizar agentes trabajando
- Empezar por MVP (8.1) → 2 semanas
- Luego Interactions (8.2) → 1 semana
- Multi-Floor (8.3) es opcional/futuro

### Tier 1: Core Functionality (Must Have)
1. **Fase 1** - Activity Logger Real → sin esto lo demás no tiene sentido
2. **Fase 3** - Cron Manager completo → uso diario
3. **Fase 2** - Memory Browser → gestión de conocimiento

### Tier 2: High Value (Should Have)
4. **Fase 5** - Command Terminal + Session History → interacción directa
5. **Fase 9.4** - Quick Actions Hub → productividad inmediata
6. **Fase 10.1** - Sub-Agent Dashboard → visibilidad de workflows

### Tier 3: Intelligence & Insights (Nice to Have)
7. **Fase 4** - Analytics básicos → métricas
8. **Fase 9.2** - Token Economics → optimización de costes
9. **Fase 9.6** - Smart Suggestions → IA que se auto-mejora

### Tier 4: Advanced Features (Wow Factor)
10. **Fase 9.3** - Knowledge Graph → visualización avanzada
11. **Fase 11.2** - Heatmaps Interactivos → análisis visual
12. **Fase 10.2** - Agent Communication Graph → debugging multi-agent

### Tier 5: Polish & Experimental (Future)
13. **Fase 7** - Real-time updates → UX premium
14. **Fase 11.1** - 3D Workspace Explorer (no-office) → alternativa visual
15. **Fase 12** - Collaboration → equipo/público

### Tier 6: Admin & Config (When Needed)
16. **Fase 6** - Skills Manager + Config Editor → cuando sea necesario

**Nota:** The Office 3D (Fase 8) es la feature flagship. Priorizar su MVP antes que otras fases avanzadas.

---

*Creado: 2026-02-07*
*Última actualización: 2026-08-17 (v0.4.0)*
