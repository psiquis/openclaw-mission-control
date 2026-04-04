// Built-in skill templates for the Template System (Phase 2)

export interface TemplateFile {
  path: string;
  template: string;
  executable?: boolean;
}

export interface TemplateParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required?: boolean;
  default?: string;
  description: string;
  options?: string[];
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  category: string;
  risk_level: string;
  version: string;
  author: string;
  files: TemplateFile[];
  params: TemplateParam[];
}

export const BUILTIN_TEMPLATES: TemplateDef[] = [
  {
    id: 'basic',
    name: 'Basic Skill',
    description: 'Skill sencilla con SKILL.md y directorio references/. Sin scripts ni exec. Ideal para knowledge bases, guías, documentación.',
    category: 'general',
    risk_level: 'low',
    version: '1.0.0',
    author: 'system',
    files: [
      {
        path: 'SKILL.md',
        template: `---
name: {{name}}
description: >
  {{description}}
---

# {{title}}

## Cuándo usar

{{whenToUse}}

## Instrucciones

{{instructions}}

## Referencias

Ver \`references/\` para documentación adicional.
`,
      },
      { path: 'references/.gitkeep', template: '' },
    ],
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la skill (kebab-case)' },
      { name: 'description', type: 'string', required: true, description: 'Descripción para el frontmatter' },
      { name: 'title', type: 'string', required: true, description: 'Título del SKILL.md' },
      { name: 'whenToUse', type: 'string', default: 'TODO: Describir cuándo usar esta skill', description: 'Cuándo se activa' },
      { name: 'instructions', type: 'string', default: 'TODO: Instrucciones paso a paso', description: 'Instrucciones principales' },
    ],
  },
  {
    id: 'exec-task',
    name: 'Skill con Script',
    description: 'Skill que ejecuta un script bash/python. Incluye SKILL.md, scripts/ y references/. Para tareas automatizadas.',
    category: 'automation',
    risk_level: 'medium',
    version: '1.0.0',
    author: 'system',
    files: [
      {
        path: 'SKILL.md',
        template: `---
name: {{name}}
description: >
  {{description}}
---

# {{title}}

## Ejecución

\`\`\`bash
bash ~/.openclaw/skills/{{name}}/scripts/{{mainScript}}
\`\`\`

## Qué hace

{{whatItDoes}}

## Prerequisitos

{{prerequisites}}
`,
      },
      {
        path: 'scripts/{{mainScript}}',
        template: `#!/usr/bin/env bash
set -euo pipefail

# {{name}} — {{description}}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando {{name}}..."

# TODO: Implementar lógica

echo "[$(date '+%Y-%m-%d %H:%M:%S')] {{name}} completado."
`,
        executable: true,
      },
      { path: 'references/.gitkeep', template: '' },
    ],
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre de la skill (kebab-case)' },
      { name: 'description', type: 'string', required: true, description: 'Descripción breve' },
      { name: 'title', type: 'string', required: true, description: 'Título del SKILL.md' },
      { name: 'mainScript', type: 'string', default: 'run.sh', description: 'Nombre del script principal' },
      { name: 'whatItDoes', type: 'string', default: 'TODO: Describir funcionalidad', description: 'Qué hace la skill' },
      { name: 'prerequisites', type: 'string', default: 'Ninguno', description: 'Requisitos previos' },
    ],
  },
  {
    id: 'stateful',
    name: 'Skill con Estado',
    description: 'Skill con directorio data/ propio para persistir estado (SQLite, JSON, etc.). Incluye scripts/ y config.json.',
    category: 'general',
    risk_level: 'medium',
    version: '1.0.0',
    author: 'system',
    files: [
      {
        path: 'SKILL.md',
        template: `---
name: {{name}}
description: >
  {{description}}
---

# {{title}}

## Ejecución

\`\`\`bash
bash ~/.openclaw/skills/{{name}}/scripts/run.sh
\`\`\`

## Estado

Esta skill mantiene estado en \`data/\`. No borrar ese directorio.

## Configuración

Editar \`config.json\` para ajustar parámetros.

## Qué hace

{{whatItDoes}}
`,
      },
      {
        path: 'scripts/run.sh',
        template: `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="\${SKILL_DIR}/data"
CONFIG="\${SKILL_DIR}/config.json"

mkdir -p "$DATA_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] {{name}} — inicio"
# TODO: Implementar lógica con estado en $DATA_DIR
echo "[$(date '+%Y-%m-%d %H:%M:%S')] {{name}} — fin"
`,
        executable: true,
      },
      {
        path: 'config.json',
        template: `{
  "name": "{{name}}",
  "version": "1.0.0",
  "settings": {}
}
`,
      },
      { path: 'data/.gitkeep', template: '' },
      { path: 'references/.gitkeep', template: '' },
    ],
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre (kebab-case)' },
      { name: 'description', type: 'string', required: true, description: 'Descripción' },
      { name: 'title', type: 'string', required: true, description: 'Título' },
      { name: 'whatItDoes', type: 'string', default: 'TODO: Describir', description: 'Funcionalidad' },
    ],
  },
  {
    id: 'automation',
    name: 'Automatización (cron-ready)',
    description: 'Skill diseñada para ejecutarse via cron. Idempotente, con logging estructurado y output para OpenClaw.',
    category: 'automation',
    risk_level: 'medium',
    version: '1.0.0',
    author: 'system',
    files: [
      {
        path: 'SKILL.md',
        template: `---
name: {{name}}
description: >
  {{description}}
  Diseñada para ejecución automática via cron. Idempotente.
---

# {{title}}

## Ejecución

\`\`\`bash
bash ~/.openclaw/skills/{{name}}/scripts/run.sh
\`\`\`

## Programación CRON recomendada

\`{{cronExpr}}\` — {{cronDescription}}

## Qué hace

{{whatItDoes}}

## Idempotencia

Esta skill es segura para ejecutar múltiples veces. {{idempotencyNote}}
`,
      },
      {
        path: 'scripts/run.sh',
        template: `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BKDATE="$(date +%Y-%m-%d)"
BKTIME="$(date +%H:%M:%S)"
START_EPOCH="$(date +%s)"
ERRORS=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2; ERRORS=$((ERRORS+1)); }

log "========================================="
log "{{name}} — \${BKDATE} \${BKTIME}"
log "========================================="

# TODO: Implementar lógica idempotente

END_EPOCH="$(date +%s)"
DURATION=$(( END_EPOCH - START_EPOCH ))

log "Completado en \${DURATION}s con \${ERRORS} errores"

cat << EOF
**{{title}}** — \${BKDATE}
- ⏱ Duración: \${DURATION}s
- ❌ Errores: \${ERRORS}
EOF

[[ \$ERRORS -eq 0 ]] && exit 0 || exit 1
`,
        executable: true,
      },
      { path: 'references/.gitkeep', template: '' },
    ],
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre (kebab-case)' },
      { name: 'description', type: 'string', required: true, description: 'Descripción' },
      { name: 'title', type: 'string', required: true, description: 'Título' },
      { name: 'whatItDoes', type: 'string', default: 'TODO: Describir', description: 'Funcionalidad' },
      { name: 'cronExpr', type: 'string', default: '0 3 * * *', description: 'Expresión cron recomendada' },
      { name: 'cronDescription', type: 'string', default: 'Diario a las 3:00', description: 'Descripción del cron' },
      { name: 'idempotencyNote', type: 'string', default: 'Re-ejecutar no causa duplicados ni efectos secundarios.', description: 'Nota de idempotencia' },
    ],
  },
  {
    id: 'api-integration',
    name: 'Integración API',
    description: 'Skill para integrar con APIs externas. Incluye manejo de auth, retry, y documentación de endpoints.',
    category: 'api',
    risk_level: 'medium',
    version: '1.0.0',
    author: 'system',
    files: [
      {
        path: 'SKILL.md',
        template: `---
name: {{name}}
description: >
  {{description}}
---

# {{title}}

## API

- **Base URL:** {{apiBaseUrl}}
- **Auth:** {{authMethod}}

## Uso

{{usage}}

## Endpoints relevantes

Ver \`references/api-docs.md\` para documentación completa.

## Configuración

Las credenciales se configuran via variables de entorno, NO hardcodeadas.
`,
      },
      {
        path: 'references/api-docs.md',
        template: `# API Documentation — {{title}}

## Base URL

\`{{apiBaseUrl}}\`

## Authentication

{{authMethod}}

## Endpoints

### GET /example
TODO: Documentar endpoints relevantes
`,
      },
      { path: 'scripts/.gitkeep', template: '' },
    ],
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre (kebab-case)' },
      { name: 'description', type: 'string', required: true, description: 'Descripción' },
      { name: 'title', type: 'string', required: true, description: 'Título' },
      { name: 'apiBaseUrl', type: 'string', default: 'https://api.example.com', description: 'URL base de la API' },
      { name: 'authMethod', type: 'string', default: 'Bearer token via env var', description: 'Método de autenticación' },
      { name: 'usage', type: 'string', default: 'TODO: Describir uso', description: 'Cómo usar' },
    ],
  },
  {
    id: 'workflow',
    name: 'Workflow Multi-paso',
    description: 'Skill para procesos con múltiples pasos secuenciales. Incluye references/steps.md con el flujo detallado.',
    category: 'workflow',
    risk_level: 'medium',
    version: '1.0.0',
    author: 'system',
    files: [
      {
        path: 'SKILL.md',
        template: `---
name: {{name}}
description: >
  {{description}}
---

# {{title}}

## Flujo

{{flowSummary}}

## Pasos detallados

Ver \`references/steps.md\` para el flujo completo paso a paso.

## Prerequisitos

{{prerequisites}}
`,
      },
      {
        path: 'references/steps.md',
        template: `# {{title}} — Pasos detallados

## Paso 1: {{step1}}
TODO: Detallar

## Paso 2: {{step2}}
TODO: Detallar

## Paso 3: {{step3}}
TODO: Detallar
`,
      },
      { path: 'scripts/.gitkeep', template: '' },
    ],
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre (kebab-case)' },
      { name: 'description', type: 'string', required: true, description: 'Descripción' },
      { name: 'title', type: 'string', required: true, description: 'Título' },
      { name: 'flowSummary', type: 'string', default: 'TODO: Resumen del flujo', description: 'Resumen del workflow' },
      { name: 'prerequisites', type: 'string', default: 'Ninguno', description: 'Requisitos' },
      { name: 'step1', type: 'string', default: 'Inicio', description: 'Nombre paso 1' },
      { name: 'step2', type: 'string', default: 'Procesamiento', description: 'Nombre paso 2' },
      { name: 'step3', type: 'string', default: 'Resultado', description: 'Nombre paso 3' },
    ],
  },
  {
    id: 'monitoring',
    name: 'Monitoreo / Alertas',
    description: 'Skill para monitorear servicios, recursos o métricas. Con estado para historial y scripts de check.',
    category: 'monitoring',
    risk_level: 'low',
    version: '1.0.0',
    author: 'system',
    files: [
      {
        path: 'SKILL.md',
        template: `---\nname: {{name}}\ndescription: >\n  {{description}}\n---\n\n# {{title}}\n\n## Ejecución\n\n\`\`\`bash\nbash ~/.openclaw/skills/{{name}}/scripts/check.sh\n\`\`\`\n\n## Qué monitoriza\n\n{{whatItMonitors}}\n\n## Umbrales\n\nConfigurar en \`config.json\`.\n`,
      },
      {
        path: 'scripts/check.sh',
        template: `#!/usr/bin/env bash\nset -euo pipefail\nSCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"\nSKILL_DIR="$(dirname "$SCRIPT_DIR")"\n\necho "[$(date '+%Y-%m-%d %H:%M:%S')] {{name}} — check inicio"\n# TODO: Implementar checks\necho "[$(date '+%Y-%m-%d %H:%M:%S')] {{name}} — check OK"\n`,
        executable: true,
      },
      {
        path: 'config.json',
        template: `{\n  "name": "{{name}}",\n  "thresholds": {},\n  "alerts": {}\n}\n`,
      },
      { path: 'data/.gitkeep', template: '' },
    ],
    params: [
      { name: 'name', type: 'string', required: true, description: 'Nombre (kebab-case)' },
      { name: 'description', type: 'string', required: true, description: 'Descripción' },
      { name: 'title', type: 'string', required: true, description: 'Título' },
      { name: 'whatItMonitors', type: 'string', default: 'TODO: Describir qué monitoriza', description: 'Qué se monitoriza' },
    ],
  },
];
