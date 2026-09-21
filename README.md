# Dashboard Arduino • EVA LTDA

Aplicativo desktop **exclusivo para Windows 10 e 11 (x64)** de monitoramento industrial em tempo real de sensores conectados fisicamente a um **Arduino UNO via porta Serial USB (COMx)**.

Projeto oficial:
- Repositório: <https://github.com/Eva-ltda/PAT>
- Owner: **Eva-ltda**
- Repo: **PAT**

## O que o Dashboard Arduino faz

- Leitura em tempo real de **3 termopares Tipo K (MAX6675)** (`T1`, `T2`, `T3`)
- Leitura em tempo real do **sensor ambiental Bosch BME680** montado junto ao Arduino:
  - Temperatura ambiente
  - Umidade relativa do ar
  - Pressão atmosférica **real** (hPa)
  - Resistência do gás (**VOC**) → classificação de qualidade do ar em 6 faixas
- Detecção e reconexão automática de portas COM (COM3/COM4/COM5…)
- Controle do usuário: **Conectar / Desconectar** (Arduino) e **Iniciar coleta / Parar coleta** (gravação de dados)
- Histórico de coletas **sem limite de 900 registros** (persistência incremental em disco JSONL em `%AppData%`)
- Exportação em **CSV compatível com Excel** de **todos os dados coletados** (utiliza janela de diálogo de salvamento, funciona com pastas sincronizadas por OneDrive)
- Backup automático (início de sessão, pausa, encerramento) + backup sob demanda
- Console serial integrado para diagnóstico
- **Atualização automática via GitHub Releases** (electron-updater) — o usuário só precisa instalar o app uma vez
- Instalador **NSIS** (para instalar no Windows) + executável **Portable** (para rodar direto sem instalação)
- Segurança: Electron `contextIsolation:true`, `nodeIntegration:false`, preload seguro via contextBridge
- Menu nativo oculto; DevTools indisponível na versão empacotada final

## Requisitos Windows (mínimo)

- **SO:** Windows 10 x64 ou Windows 11 x64
- **CPU:** qualquer x64 recente
- **RAM:** 2 GB livres (recomendado 4 GB)
- **Disco:** ~400 MB de espaço livre para instalação + log/backups
- **Porta USB livre:** 1x USB-A ou USB-C
- **Hardware Arduino UNO configurado:**
  - 1 × Arduino UNO
  - 3 × módulo MAX6675 + termopar Tipo K (T1 / T2 / T3)
  - 1 × módulo Bosch **BME680** (I²C)
  - Firmware compatível que escreve no Serial 9600 8N1 a linha por amostra:
    ```
    t1,t2,t3,temp,hum,pressure,voc
    ```
    Exemplo de linha válida (valores reais lidos do sensor):
    ```
    125.4,98.2,210.7,28.1,52.9,955.59,125.0
    ```
- (Opcional) **Cabo USB de dados** para conectar Arduino UNO ao PC.

## Instalação

### Opção A: Instalador NSIS (recomendado para cliente final)
1. Baixe a versão mais recente em **Releases → <https://github.com/Eva-ltda/PAT/releases>**
2. Execute `Eva - Dashboard Setup X.Y.Z.exe`
3. Siga as instruções; escolha pasta de instalação
4. Atalho é criado automaticamente no Menu Iniciar / Área de Trabalho
5. Ao abrir o app pela primeira vez, autorize acesso ao Driver USB Serial do Windows quando solicitado

### Opção B: Executável Portátil (sem instalar)
1. Baixe `Eva - Dashboard X.Y.Z.exe` na release
2. Copie para uma pasta em disco local (Área de Trabalho, Downloads, etc.)
3. Execute diretamente — não precisa de instalação.
4. Recomenda-se não rodar de pastas sincronizadas pelo OneDrive (pode causar bloqueio de escrita no backup).

## Uso diário

1. **Conecte o Arduino UNO via USB** antes de abrir o app, ou a qualquer momento.
2. Abra o **Dashboard Arduino** (EVA LTDA).
3. No **Header** superior:
   - O chip de status detecta automaticamente a porta (ex.: `● Conectado • COM4`).
   - Se precisar: clique no status para escolher outra porta COM listada.
   - Ao lado, o botão `[Desconectar]` fecha a comunicação com a porta (trava reconexão automática até o usuário clicar em `[Conectar]`).
4. A **coleta** inicia automaticamente quando a primeira leitura válida chega.
   - Para parar de registrar (mas manter Arduino conectado): clique em `[Parar coleta]`.
   - Para retomar: `[Iniciar coleta]`.
5. Para **exportar** a sessão: clique em `[Exportar]` e escolha a pasta de destino.
   - Gera CSV compatível com Excel, UTF-8 com BOM, separador `;`.
   - Contém **TODOS** os dados coletados desde o início da sessão (não só os 900 últimos do gráfico).
6. Para **backup imediato**: `[Backup agora]` — grava em `userData\Backups\YYYY-MM-DD\`
7. No **Footer inferior:**
   - Status: Online / Pausado / Offline
   - Última leitura (há quanto tempo)
   - Contagem total de registros coletados
   - Versão em execução (ex.: `Patch 1.1.12`) — vinda de `app.getVersion()` (real, nunca hardcoded)

## Arduino + Portas COM

- Baud rate padrão de fábrica do firmware: **9600 8N1**
- O app lista todas as portas COM do sistema; o usuário pode trocar a qualquer momento.
- Se você desconectar o Arduino **fisicamente**, o app sinaliza e tenta reconectar periodicamente.
- Se você clicar em **Desconectar** via interface, o app **NÃO** reconecta sozinho até o usuário clicar em **Conectar**.
- Se o Windows não detectar a porta COM, instale o driver **CH340 / CP210x / Arduino Uno Driver** (depende do seu módulo USB-serial).

## Sensores e tratamento de NaN

Quando um MAX6675 retorna leitura inválida (ex.: termopar desconectado → `nan`):
- Aquele termopar mostra `---` ou "Sem leitura"
- Os outros termopares e o BME680 continuam exibindo normalmente
- A coleta não é interrompida
- Nenhum outro valor é zerado ou derrubado

## Exportação CSV (Excel)

Colunas exportadas (10):
```
Data;Hora;Termopar 1;Termopar 2;Termopar 3;Temperatura Ambiente;Umidade;Pressão;VOC;Qualidade do Ar
```

- Valores numéricos com vírgula decimal (`pt-BR`) → Excel abre direto sem configurar importação.
- UTF-8 com BOM (acentos e "Qualidade do Ar" aparecem corretamente).
- **Não há limite de 900 registros:** se a coleta iniciou às 08:00 e exportou às 14:32, o arquivo conterá **todas** as amostras de 08:00 até 14:32 (centenas de milhares, se for o caso).
- **Diálogo de salvamento seguro:** usa `dialog.showSaveDialog` (Electron Main) com escrita atômica de arquivo temporário → renomeação pós-sucesso; inclui tratamento de erro amigável para:
  - `EPERM/EACCES` (OneDrive bloqueando a pasta de destino → sugere salvar em Área de Trabalho/Downloads/Temp)
  - `EBUSY` (arquivo aberto no Excel: pede para fechar e tentar de novo)
  - `ENOSPC` (sem espaço em disco)
  - `EISDIR` (caminho escolhido é uma pasta, não arquivo)

## Backup automático e sob demanda

- Local: `%AppData%\<appId>\Backups\YYYY-MM-DD\`
  - `appId` instalado = `com.pattermico.dashboard.arduino`
  - Em desenvolvimento local = pasta `.electron-temp/userData/Backups/` do projeto
- Quatro momentos de backup automático:
  1. **Início de sessão** (quando app inicia e detecta sessão anterior não-vazia) → prefixo `inicio_`
  2. **Pausa da coleta** (usuário clica em Parar coleta) → prefixo `pausa_`
  3. **Fim de sessão** (app fecha normalmente) → prefixo `fim_` (sem duplicar sobre pausa)
  4. **Sob demanda** (botão Header `[Backup agora]`) → prefixo `manual_`
- Cada backup sempre contém **todas as amostras coletadas desde o início da sessão** (não só os 900 últimos do gráfico).
- Persistência incremental em JSONL em `Sessions/sess_*.jsonl` (append a cada nova amostra válida, mesmo com queda de energia)

## Atualização automática (GitHub Releases + electron-updater)

Funcionamento padrão (configurado no `electron/main.cjs`, `configureAutoUpdater()`):
1. App inicia → consulta `https://github.com/Eva-ltda/PAT/releases/latest`
2. Se existir versão mais nova disponível: abre diálogo de confirmação:
   ```
   Há uma nova versão do Dashboard Arduino.

   Versão atual: 1.12.0
   Nova versão: 1.12.1

   Deseja baixar e instalar agora?
                                 [Sim] [Não]
   ```
3. **Se usuário clicar Não:** não baixa nada, não instala. Continuam as verificações periódicas a cada 30 minutos.
4. **Se Sim:** baixa o pacote de atualização (mostra progresso em log) e quando pronto:
   ```
   A nova versão do Dashboard Arduino já foi baixada.

   Nova versão: 1.12.1

   Clique em Reiniciar agora para aplicar.
                          [Reiniciar agora] [Depois]
   ```
5. A atualização também é instalada automaticamente se o usuário fechar o app com ela já baixada.

### Como gerar uma Release nova (passo a passo)

1. Edite `package.json` e incremente `"version"` (ex.: `1.1.12` → `1.1.13`)
2. Commit:
   ```bash
   git add -A
   git commit -m "release: v1.1.13"
   ```
3. Crie uma **tag anotada** com o padrão `vMAJOR.MINOR.PATCH`:
   ```bash
   git tag -a v1.1.13 -m "Release v1.1.13"
   ```
4. Envie commit e tag para o repositório oficial:
   ```bash
   git push origin main
   git push origin v1.1.13
   ```
5. O GitHub Actions dispara automaticamente o workflow `release.yml` (`on: push tags: v*`), roda em `windows-2022`, executa `npm ci`, `lint`, `build:renderer`, `electron-builder --win --x64 --publish always` e publica:
   - `Eva - Dashboard Setup 1.1.13.exe` (NSIS instalador cliente)
   - `Eva - Dashboard 1.1.13.exe` (Portable)
   - `latest.yml` (manifesto usado pelo electron-updater)
   - `*.blockmap` (arquivos delta de atualização)
6. **A partir desse momento**, todos os clientes com versões anteriores detectam a atualização no próximo start ou na próxima verificação de 30/30 min.

## Desenvolvimento local no Windows

### Stack
- **Electron 42** → janela desktop + processo main/preload seguro
- **Node 20+** recomendado
- **React 19** + **TypeScript strict** + **Vite 7** (renderizador)
- **Tailwind CSS 3** (UI)
- **Recharts 2** (gráfico de histórico)
- **serialport 12** + @serialport/parser-readline (comunicação nativa Windows COM)
- **socket.io 4** (eventos em tempo real main ↔ renderer)
- **electron-builder 26** (empacota NSIS + Portable Windows x64)
- **electron-updater 6.8.9** (auto-update via GitHub Releases)

### Iniciar app em desenvolvimento
```powershell
cd d:\PAT
npm install   # (ou npm ci --include=dev se package-lock existe)
npm run dev
```
- Abre **Vite** (porta do SO, fallback 5173) + **Electron desktop**
- Em desenvolvimento: DevTools continua disponível via atalhos. Na versão empacotada final, DevTools é bloqueado por padrão.

### Build local de release (para cliente, exige admin p/ rebuild do serialport)
```cmd
cd /d d:\PAT
BUILD-WINDOWS-ADMIN.cmd
```
Saída em `d:\PAT\release\win\`:
```
Eva - Dashboard Setup X.Y.Z.exe    (NSIS instalador x64)
Eva - Dashboard X.Y.Z.exe          (Portable x64)
latest.yml
*.blockmap
```

### Build de release via CI
Basta push da tag `vX.Y.Z` para o repositório `Eva-ltda/PAT`. O workflow `release.yml` publica tudo automaticamente em GitHub Releases.

## Estrutura do projeto (visão rápida)

```
electron/
  main.cjs                ← Processo principal Electron (Serial, Socket.IO, backups, export, janela, auto-update)
  preload.cjs             ← ContextBridge: window.DashboardArduino.* (seguro)
  lib/parsers.cjs         ← Parsers puros: MAX6675/BME680 + calcQualidadeVOC (6 faixas)
  wait-for-vite.cjs       ← Atraso para abrir Electron só depois do Vite subir
src/
  App.tsx                 ← Componente React pai, estado global, eventos socket
  components/
    Header.tsx            ← Logo, Exportar, Backup, Parar/Iniciar coleta, status COM, relógio
    Footer.tsx            ← Status, última leitura, contagem, Patch (versão real do app)
    ThermocoupleCard.tsx  ← T1, T2, T3
    EnvCard.tsx           ← TA, Umidade, Pressão
    VocQuality.tsx        ← VOC + Qualidade do Ar
    HistoryChart.tsx      ← Gráfico Recharts (últimas 180 amostras, só visual)
    SerialConsole.tsx     ← Console serial (tail)
  lib/types.ts            ← SensorPayload, ConnectionStatus, SessionInfo
  lib/voc.ts, socket.ts
.github/workflows/
  build-win.yml           ← Build de cada push/PR main (artifact zip)
  release.yml             ← Build + publicação em GitHub Release (tag v*)
build/                    ← Ícones do electron-builder
tests/parsers.node.cjs    ← Node --test: valida parsers.cjs
package.json              ← Versão oficial + scripts + electron-builder config
README.md                 ← Este documento
```

## Segurança (eletron)

- `contextIsolation: true` — nunca desativar
- `nodeIntegration: false` — nunca habilitar
- Todo acesso a Node (portas COM, export, backup, versão, status) passa por `electron/preload.cjs` via `contextBridge.exposeInMainWorld` + `ipcRenderer.invoke`
- Arquivos sensíveis (backup, sessões JSONL) ficam em `app.getPath('userData')` — nunca dentro da pasta `Program Files`
- Diálogos de salvamento de exportação usam sempre `dialog.showSaveDialog` (main process) ao invés de assumir pasta Documents

## Problemas comuns

| Sintoma | Causa provável | Resolução |
|---|---|---|
| App abre mas status permanece Desconectado | Arduino não está plugado na USB ou driver serial ausente | Troque cabo/porta USB; instale driver CH340/CP210x; confirme que Gerenciador de Dispositivos → Portas (COM/LPT) mostra a COM do Arduino |
| Termopar mostra `---` | Termopar fisicamente desconectado do MAX6675 | Conecte o termopar no borninho do MAX6675; observe polaridade |
| Pressão aparece 0,00 hPa ou `---` | BME680 ausente/mau contato I²C (SDA/SCL/GND/VCC) | Verifique ligação I²C do BME680 no Arduino UNO (A4/A5 ou SDA/SCL específicos) |
| Exportação dá erro "Você não tem permissão… OneDrive" | Pasta padrão Documents sincronizada e bloqueada | No diálogo de salvamento escolha a **Área de Trabalho** ou pasta fora do OneDrive. O app também oferece fallback automático. |
| Atualização não aparece no cliente | Versão instalada == versão latest, ou GH_TOKEN na release falhou, ou publish.owner/repo errados no package.json | Confirme em package.json: `build.publish.owner=Eva-ltda`, `repo=PAT`; confira se Release do GitHub tem `latest.yml` anexado. |

## Criação de release — comandos resumidos

```bash
# 1) Atualizar versão em package.json
# 2) Commit
git add -A
git commit -m "release: v1.1.13"
# 3) Tag anotada
git tag -a v1.1.13 -m "Release v1.1.13"
# 4) Push branch + tag
git push origin main
git push origin v1.1.13
```

## Proibido / fora de escopo deste projeto

- Compilação para **Linux (AppImage, .deb, .rpm, pacman, etc.)**
- Compilação para macOS
- Sensores simulados, pressão fake ou dados dummy
- Substituição de Electron, React, Vite, TypeScript, SerialPort ou electron-updater
- `git push` ou `git reset --hard` sem autorização explícita
