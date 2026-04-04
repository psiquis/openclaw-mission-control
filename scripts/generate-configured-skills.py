#!/usr/bin/env python3
import json
import os
from datetime import datetime

SYSTEM_SKILLS = "/home/ola3/.openclaw/skills"
WORKSPACE_SKILLS = "/home/ola3/.openclaw/workspace/skills"
OUTPUT = "data/configured-skills.json"

def collect_skills(base_path, location):
    items = []
    if not os.path.isdir(base_path):
        return items

    for name in sorted(os.listdir(base_path)):
        path = os.path.join(base_path, name)
        skill_md = os.path.join(path, "SKILL.md")
        if os.path.isdir(path) and os.path.isfile(skill_md):
            items.append({
                "name": name,
                "location": location,
                "description": f"{location} skill: {name}"
            })
    return items

skills = []
skills.extend(collect_skills(SYSTEM_SKILLS, "system"))
skills.extend(collect_skills(WORKSPACE_SKILLS, "workspace"))

payload = {
    "lastUpdated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "systemSkillsPath": SYSTEM_SKILLS,
    "workspaceSkillsPath": WORKSPACE_SKILLS,
    "skills": skills
}

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)

print(json.dumps(payload, indent=2, ensure_ascii=False))
