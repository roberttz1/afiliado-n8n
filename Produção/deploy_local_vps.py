#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Ativação Rápida e Injeção do Workflow na VPS
=====================================================
Executado diretamente no terminal root da VPS:
1. Instala dependências (httpx, beautifulsoup4, redis)
2. Injeta o workflow 'extrair Cupons ML' no SQLite do n8n
3. Reinicia o container do n8n de forma segura
"""

import json
import os
import sqlite3
import subprocess
import uuid

SQLITE_PATH = "/var/lib/docker/volumes/prospects_n8n_data/_data/database.sqlite"
N8N_CONTAINER = "evolution-n8n-1"
WF_FILE = "/root/wf_extrair_cupons_ml.json"

print("==================================================")
print("🚀 INICIANDO INSTALAÇÃO E DEPLOY NA VPS")
print("==================================================")

# 1. Instalar bibliotecas Python no host
print("\n📦 1. Instalando bibliotecas Python necessárias...")
subprocess.run(["pip3", "install", "httpx", "beautifulsoup4", "redis", "--break-system-packages"], check=False)

# 2. Injetar workflow no SQLite do n8n se o banco existir
if os.path.exists(SQLITE_PATH) and os.path.exists(WF_FILE):
    print(f"\n🛑 2. Parando temporariamente o container {N8N_CONTAINER} para liberar o SQLite...")
    subprocess.run(["docker", "stop", N8N_CONTAINER], check=False)

    print(f"💾 3. Injetando 'extrair Cupons ML' no banco do n8n...")
    try:
        conn = sqlite3.connect(SQLITE_PATH)
        c = conn.cursor()

        with open(WF_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        wf_name = data.get("name", "extrair Cupons ML")
        nodes = json.dumps(data.get("nodes", []))
        connections = json.dumps(data.get("connections", {}))
        settings = json.dumps(data.get("settings", {"executionOrder": "v1"}))

        # Obter projeto principal
        c.execute("SELECT id FROM project LIMIT 1")
        proj_row = c.fetchone()
        project_id = proj_row[0] if proj_row else "Ylh570ea40Z1K7yg"

        # Obter ou criar tag 'afiliados'
        c.execute("SELECT id FROM tag_entity WHERE name = 'afiliados'")
        tag_row = c.fetchone()
        if not tag_row:
            tag_id = str(uuid.uuid4())[:16]
            c.execute("INSERT INTO tag_entity (id, name, createdAt, updatedAt) VALUES (?, 'afiliados', datetime('now'), datetime('now'))", (tag_id,))
        else:
            tag_id = tag_row[0]

        # Verificar se workflow já existe
        c.execute("SELECT id FROM workflow_entity WHERE name = ?", (wf_name,))
        row = c.fetchone()

        if row:
            wf_id = row[0]
            version_id = str(uuid.uuid4())
            c.execute("""
                UPDATE workflow_entity 
                SET nodes = ?, connections = ?, settings = ?, versionId = ?, updatedAt = datetime('now'), nodeGroups = '[]'
                WHERE id = ?
            """, (nodes, connections, settings, version_id, wf_id))
            print(f"  ✅ Workflow '{wf_name}' ATUALIZADO com sucesso! (ID: {wf_id})")
        else:
            wf_id = str(uuid.uuid4())[:16]
            version_id = str(uuid.uuid4())
            c.execute("""
                INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, versionId, nodeGroups, versionCounter, isArchived, createdAt, updatedAt)
                VALUES (?, ?, 0, ?, ?, ?, ?, '[]', 1, 0, datetime('now'), datetime('now'))
            """, (wf_id, wf_name, nodes, connections, settings, version_id))
            print(f"  ✅ Workflow '{wf_name}' INSERIDO com sucesso! (ID: {wf_id})")

        # Vincular ao projeto
        c.execute("SELECT workflowId FROM shared_workflow WHERE workflowId = ? AND projectId = ?", (wf_id, project_id))
        if not c.fetchone():
            c.execute("INSERT INTO shared_workflow (workflowId, projectId, role, createdAt, updatedAt) VALUES (?, ?, 'workflow:owner', datetime('now'), datetime('now'))", (wf_id, project_id))

        # Vincular à tag 'afiliados'
        c.execute("SELECT workflowId FROM workflows_tags WHERE workflowId = ? AND tagId = ?", (wf_id, tag_id))
        if not c.fetchone():
            c.execute("INSERT INTO workflows_tags (workflowId, tagId) VALUES (?, ?)", (wf_id, tag_id))

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"  ❌ Erro ao atualizar SQLite: {e}")

    print(f"\n🚀 4. Reiniciando container {N8N_CONTAINER}...")
    subprocess.run(["docker", "start", N8N_CONTAINER], check=False)
else:
    print(f"  [AVISO] Arquivo {SQLITE_PATH} ou {WF_FILE} não encontrado. O workflow pode ser importado via interface web do n8n.")

print("\n==================================================")
print("🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!")
print("==================================================")
print("Para rodar o scraper agora mesmo, execute:")
print("python3 /root/scraper_cupons_ml.py --origem-cookies redis --redis-host localhost --redis-port 6380 --redis-key cookies-mercadolivre-cupons --meta 10")
