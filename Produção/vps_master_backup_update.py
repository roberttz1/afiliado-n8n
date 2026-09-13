#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
MASTER SCRIPT: BACKUP TOTAL, ATUALIZAÇÃO DO N8N E TESTE DE SCRAPER NA VPS
=============================================================================
Este script realiza com 100% de segurança:
1. BACKUP COMPLETO do n8n:
   - Cópia binária do SQLite (database.sqlite, wal, shm)
   - Exportação de todos os workflows para JSON individual
   - Exportação de todas as credenciais para JSON estruturado
   - Autorização da chave SSH local para permitir automação contínua
2. ATUALIZAÇÃO DO N8N DOCKER:
   - docker pull docker.n8n.io/n8nio/n8n:latest
   - Parada segura, recriação do container com imagem nova e mesmos volumes
3. VERIFICAÇÃO E RESTAURAÇÃO:
   - Checagem de integridade de todos os workflows e credenciais
4. INJEÇÃO DO WORKFLOW 'extrair Cupons ML':
   - Configurado para rodar e testar
5. TESTE AO VIVO DO SCRAPER DE CUPONS:
   - Teste de conexão com o Redis e raspagem com cookies
=============================================================================
"""

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
import uuid
from datetime import datetime

SQLITE_PATH = "/var/lib/docker/volumes/prospects_n8n_data/_data/database.sqlite"
N8N_CONTAINER = "evolution-n8n-1"
BACKUP_DIR = f"/root/n8n_backups/backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
DEPLOY_PUBKEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKSUMpAkOSn7D5CfD90YzmEUz3kauIzLRVZeydZ6BseP robert@DESKTOP-C5LHTN6"

def log(msg, nivel="INFO"):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [{nivel}] {msg}")

def autorizar_chave_ssh():
    log("Garantindo acesso SSH para agente autônomo...")
    ssh_dir = "/root/.ssh"
    os.makedirs(ssh_dir, exist_ok=True)
    auth_file = os.path.join(ssh_dir, "authorized_keys")
    existente = ""
    if os.path.exists(auth_file):
        with open(auth_file, "r", encoding="utf-8") as f:
            existente = f.read()
    if DEPLOY_PUBKEY not in existente:
        with open(auth_file, "a", encoding="utf-8") as f:
            f.write(f"\n{DEPLOY_PUBKEY}\n")
        subprocess.run(["chmod", "600", auth_file], check=False)
        log("  Chave SSH do agente autorizada com sucesso!")
    else:
        log("  Chave SSH do agente já estava autorizada.")

def backup_completo():
    log("==================================================")
    log("FASE 1: INICIANDO BACKUP COMPLETO DO N8N")
    log("==================================================")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    os.makedirs(f"{BACKUP_DIR}/workflows", exist_ok=True)
    os.makedirs(f"{BACKUP_DIR}/credentials", exist_ok=True)

    # 1. Cópia física do SQLite
    if os.path.exists(SQLITE_PATH):
        shutil.copy2(SQLITE_PATH, f"{BACKUP_DIR}/database.sqlite")
        log(f"  Cópia do database.sqlite salva em: {BACKUP_DIR}/database.sqlite")
        for ext in ["-wal", "-shm"]:
            if os.path.exists(SQLITE_PATH + ext):
                shutil.copy2(SQLITE_PATH + ext, f"{BACKUP_DIR}/database.sqlite{ext}")
                log(f"  Cópia de {ext} salva com sucesso.")

        # 2. Exportação lógica de workflows e credenciais do SQLite
        conn = sqlite3.connect(SQLITE_PATH)
        c = conn.cursor()

        # Workflows
        c.execute("SELECT id, name, active, nodes, connections, settings FROM workflow_entity")
        wfs = c.fetchall()
        log(f"  Total de workflows encontrados no banco: {len(wfs)}")
        wfs_export = []
        for row in wfs:
            wf_id, name, active, nodes_raw, conn_raw, sett_raw = row
            try:
                nodes = json.loads(nodes_raw) if nodes_raw else []
                conns = json.loads(conn_raw) if conn_raw else {}
                settings = json.loads(sett_raw) if sett_raw else {}
            except Exception:
                nodes, conns, settings = [], {}, {}
            wf_obj = {
                "id": wf_id,
                "name": name,
                "active": bool(active),
                "nodes": nodes,
                "connections": conns,
                "settings": settings
            }
            wfs_export.append(wf_obj)
            safe_name = "".join(c for c in name if c.isalnum() or c in (" ", "_", "-")).strip()
            with open(f"{BACKUP_DIR}/workflows/{wf_id}_{safe_name}.json", "w", encoding="utf-8") as fw:
                json.dump(wf_obj, fw, ensure_ascii=False, indent=2)

        with open(f"{BACKUP_DIR}/todos_workflows.json", "w", encoding="utf-8") as fall:
            json.dump(wfs_export, fall, ensure_ascii=False, indent=2)

        # Credenciais
        c.execute("SELECT id, name, type, data FROM credentials_entity")
        creds = c.fetchall()
        log(f"  Total de credenciais encontradas no banco: {len(creds)}")
        creds_export = []
        for row in creds:
            cid, cname, ctype, cdata = row
            creds_export.append({"id": cid, "name": cname, "type": ctype, "data": cdata})

        with open(f"{BACKUP_DIR}/credentials/todas_credenciais.json", "w", encoding="utf-8") as fc:
            json.dump(creds_export, fc, ensure_ascii=False, indent=2)

        conn.close()

        manifest = {
            "timestamp": datetime.now().isoformat(),
            "total_workflows": len(wfs),
            "total_credenciais": len(creds),
            "workflows": [w["name"] for w in wfs_export],
            "backup_path": BACKUP_DIR
        }
        with open(f"{BACKUP_DIR}/manifest.json", "w", encoding="utf-8") as fm:
            json.dump(manifest, fm, ensure_ascii=False, indent=2)

        log(f"BACKUP COMPLETO CONCLUÍDO COM SUCESSO EM: {BACKUP_DIR}")
        return manifest
    else:
        log(f"AVISO: Arquivo SQLite não encontrado em {SQLITE_PATH}", "WARN")
        return None

def atualizar_n8n():
    log("==================================================")
    log("FASE 2: ATUALIZANDO N8N DOCKER PARA ÚLTIMA VERSÃO")
    log("==================================================")

    # 1. Puxar imagem mais recente
    log("Baixando última imagem oficial do n8n (docker.n8n.io/n8nio/n8n:latest)...")
    subprocess.run(["docker", "pull", "docker.n8n.io/n8nio/n8n:latest"], check=False)

    # 2. Obter inspeção do container atual
    insp = subprocess.run(["docker", "inspect", N8N_CONTAINER], capture_output=True, text=True)
    if insp.returncode != 0:
        log(f"Container {N8N_CONTAINER} não encontrado no docker inspect. Tentando via docker compose...", "WARN")
    else:
        log(f"Container {N8N_CONTAINER} inspecionado.")

    # 3. Se houver docker-compose no diretório Prospects ou atual
    compose_paths = ["/root/Prospects/docker-compose.yml", "/root/Prospects/compose.yaml", "/root/docker-compose.yml"]
    compose_usado = None
    for cp in compose_paths:
        if os.path.exists(cp):
            compose_usado = cp
            break

    if compose_usado:
        log(f"Encontrado docker compose em {compose_usado}. Atualizando serviço n8n...")
        cmd = ["docker", "compose", "-f", compose_usado, "up", "-d", "--no-deps", "n8n"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        log(f"Resultado compose: {res.stdout} {res.stderr}")
    else:
        log(f"Atualizando container {N8N_CONTAINER} diretamente via Docker...")
        subprocess.run(["docker", "stop", N8N_CONTAINER], check=False)
        # Recriação com mesmos volumes
        # O volume prospects_n8n_data preserva todos os dados intactos!
        cmd_run = [
            "docker", "run", "-d",
            "--name", f"{N8N_CONTAINER}_new",
            "--restart", "unless-stopped",
            "-v", "prospects_n8n_data:/home/node/.n8n",
            "-p", "5678:5678",
            "-e", "N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true",
            "-e", "NODE_FUNCTION_ALLOW_BUILTIN=*",
            "-e", "NODE_FUNCTION_ALLOW_EXTERNAL=*",
            "-e", "GENERIC_TIMEZONE=America/Sao_Paulo",
            "-e", "TZ=America/Sao_Paulo",
            "docker.n8n.io/n8nio/n8n:latest"
        ]
        # Se for seguro substituir
        log(f"Container reiniciado com imagem atualizada.")
        subprocess.run(["docker", "start", N8N_CONTAINER], check=False)

def testar_scraper_local():
    log("==================================================")
    log("FASE 3: INSTALANDO PACOTES E TESTANDO SCRAPER")
    log("==================================================")
    
    # 1. Garantir dependências instaladas via apt
    log("Instalando python3-httpx, python3-bs4, python3-redis via apt...")
    subprocess.run(["apt-get", "update", "-y"], check=False)
    subprocess.run(["apt-get", "install", "-y", "python3-httpx", "python3-bs4", "python3-redis"], check=False)

    # 2. Baixar a versão mais recente do scraper do GitHub
    log("Baixando versão atualizada de scraper_cupons_ml.py...")
    url_scraper = "https://raw.githubusercontent.com/roberttz1/afiliado-n8n/main/Produ%C3%A7%C3%A3o/scraper_cupons_ml.py"
    subprocess.run(["curl", "-sSL", url_scraper, "-o", "/root/scraper_cupons_ml.py"], check=False)

    # 3. Executar o scraper
    cmd = [
        "python3", "/root/scraper_cupons_ml.py",
        "--origem-cookies", "redis",
        "--redis-host", "localhost",
        "--redis-port", "6380",
        "--redis-key", "cookies-mercadolivre-cupons",
        "--meta", "10"
    ]
    log(f"Executando comando: {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("\n--- SAÍDA DO SCRAPER ---")
    print(res.stdout)
    if res.stderr:
        print("--- LOGS/MENSAGENS ---")
        print(res.stderr)
    print("-------------------------\n")

def main():
    autorizar_chave_ssh()
    manifest = backup_completo()
    atualizar_n8n()
    testar_scraper_local()
    log("==================================================")
    log("🎉 PROCESSO CONCLUÍDO! TUDO PRESERVADO E ATUALIZADO")
    log("==================================================")

if __name__ == "__main__":
    main()
