"""
Script de Deploy Autônomo de Workflows n8n — Afiliados
======================================================
Este script injeta os 6 workflows de afiliados diretamente no SQLite do n8n
na VPS com parada segura do container Docker e reinício limpo.

Uso:
    python deploy_workflows.py --vps-pass SENHA_VPS
"""

import argparse
import glob
import json
import os
import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


VPS_HOST = "2.25.204.18"
VPS_USER = "root"
SQLITE_PATH = "/var/lib/docker/volumes/prospects_n8n_data/_data/database.sqlite"
N8N_CONTAINER = "evolution-n8n-1"

WORKFLOW_FILES = [
    "wf_01_coletor_conversor.json",
    "wf_02_validador_ia.json",
    "wf_03_agendador_fila.json",
    "wf_04_disparador_whatsapp.json",
    "wf_05_monitor_grupos.json",
    "wf_06_reset_diario.json"
]

def validar_workflows_locais(base_dir):
    print("🔍 Validando JSONs locais...")
    workflows = {}
    for filename in WORKFLOW_FILES:
        filepath = os.path.join(base_dir, "n8n-workflows", filename)
        if not os.path.exists(filepath):
            print(f"❌ Arquivo não encontrado: {filepath}")
            sys.exit(1)
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            workflows[filename] = data
            print(f"  ✅ {filename} — {data.get('name', 'Sem nome')} ({len(data.get('nodes', []))} nós)")
    return workflows

def conectar_vps(host, user, password):
    print(f"\n🔌 Conectando à VPS {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=20)
    print("  ✅ Conectado com sucesso!")
    return ssh

def executar_comando(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

def deploy(vps_pass):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    workflows = validar_workflows_locais(base_dir)

    ssh = conectar_vps(VPS_HOST, VPS_USER, vps_pass)
    sftp = ssh.open_sftp()

    try:
        # 1. Enviar arquivos JSON para /tmp/
        print("\n📤 Enviando workflows para /tmp/ na VPS...")
        for filename in WORKFLOW_FILES:
            local_path = os.path.join(base_dir, "n8n-workflows", filename)
            remote_path = f"/tmp/{filename}"
            sftp.put(local_path, remote_path)
            print(f"  -> /tmp/{filename}")

        # 2. Parar container n8n (regra mandatória do WAL cache)
        print(f"\n🛑 Parando container {N8N_CONTAINER}...")
        out, err = executar_comando(ssh, f"docker stop {N8N_CONTAINER}")
        print(f"  Status: {out.strip() or 'OK'}")

        # 3. Criar e executar script Python remoto para atualizar o SQLite
        print("\n💾 Atualizando tabela workflow_entity no SQLite...")
        remote_script = f"""
import sqlite3
import json
import uuid
from datetime import datetime

SQLITE_PATH = '{SQLITE_PATH}'
conn = sqlite3.connect(SQLITE_PATH)
c = conn.cursor()

workflows_info = {json.dumps(WORKFLOW_FILES)}

for wf_file in workflows_info:
    with open(f'/tmp/{{wf_file}}', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    wf_name = data.get('name')
    nodes = json.dumps(data.get('nodes', []))
    connections = json.dumps(data.get('connections', {{}}))
    settings = json.dumps(data.get('settings', {{'executionOrder': 'v1'}}))
    now = datetime.utcnow().isoformat()
    
    # Checar se já existe por nome
    c.execute("SELECT id FROM workflow_entity WHERE name = ?", (wf_name,))
    row = c.fetchone()
    
    if row:
        wf_id = row[0]
        c.execute(\"\"\"
            UPDATE workflow_entity 
            SET nodes = ?, connections = ?, settings = ?, updatedAt = datetime('now')
            WHERE id = ?
        \"\"\", (nodes, connections, settings, wf_id))
        print(f"  [ATUALIZADO] {{wf_name}} (ID: {{wf_id}})")
    else:
        wf_id = str(uuid.uuid4())[:16]
        c.execute(\"\"\"
            INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, createdAt, updatedAt)
            VALUES (?, ?, 0, ?, ?, ?, datetime('now'), datetime('now'))
        \"\"\", (wf_id, wf_name, nodes, connections, settings))
        print(f"  [INSERIDO] {{wf_name}} (ID: {{wf_id}})")

conn.commit()
conn.close()
"""
        with sftp.open("/tmp/deploy_n8n_workflows.py", "w") as f:
            f.write(remote_script)

        out, err = executar_comando(ssh, "python3 /tmp/deploy_n8n_workflows.py")
        print(out)
        if err:
            print("  Avisos/Erros:", err)

        # 4. Iniciar container n8n
        print(f"\n🚀 Reiniciando container {N8N_CONTAINER}...")
        out, err = executar_comando(ssh, f"docker start {N8N_CONTAINER}")
        print(f"  Status: {out.strip() or 'OK'}")

        # 5. Limpeza de temporários
        print("\n🧹 Limpando arquivos temporários...")
        executar_comando(ssh, "rm -f /tmp/wf_*.json /tmp/deploy_n8n_workflows.py")

        print("\n" + "="*60)
        print("🎉 DEPLOY CONCLUÍDO COM SUCESSO!")
        print("="*60)
        print("Próximos passos no painel do n8n (https://n8n.virattiva.cloud):")
        print("1. Abra cada um dos 6 novos workflows de ofertas.")
        print("2. Pressione Ctrl+S para compilar as rotas internas.")
        print("3. Ative o toggle 'Ativo' (canto superior direito) em cada fluxo.")
        print("="*60)

    finally:
        sftp.close()
        ssh.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy dos workflows n8n para VPS")
    parser.add_argument("--vps-pass", required=True, help="Senha SSH da VPS root")
    args = parser.parse_args()
    deploy(args.vps_pass)
