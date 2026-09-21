# Dashboard Arduino Windows (EVA LTDA) — Implementation Plan

## FASE 1 — Diagnóstico (já executado)

### Git atual
- **Remote atual:** `origin = https://Pat-termico@github.com/Pat-termico/Pat.git`
  → Precisa mudar para `https://github.com/Eva-ltda/PAT.git`
- **Branch:** `main`
- **Status:** 10 arquivos modificados (locais, não commitados); 3 untracked + `tmp-tests/`
- ⚠️ NÃO executar `git reset --hard` nem `git clean -fd`. NÃO fazer push automático.

### Stack atual (versões instaladas)
| Pacote | Versão | Status |
|---|---|---|
| electron | ^42.0.1 | OK, manter |
| electron-builder | ^26.0.12 | OK (valida schema já aplicado na rodada anterior) |
| electron-updater | ^6.8.9 | OK (implementação existe, precisa ajustar publish owner/repo e UI) |
| serialport | ^12.0.0 | OK, nativo Windows |
| @serialport/parser-readline | ^12.0.0 | OK |
| socket.io | ^4.8.1 / socket.io-client ^4.8.1 | OK, serial bridge local |
| react / react-dom | ^19.1.1 | OK |
| typescript | ^5.9.2 (strict:true, noEmit) | OK |
| vite | ^7.1.4 | OK |
| tailwindcss | ^3.4.17 | OK |

### Estrutura de pastas (preservar)
```
electron/
  main.cjs        (processo principal — serial, socket, backup, export, auto-updater, janela, menus)
  preload.cjs     (contextBridge window.DashboardArduino.*)
  lib/parsers.cjs (validação MAX6675/BME680 + calcQualidadeVOC)
src/
  App.tsx         (renderer React root, estado + socket handlers)
  components/*    (Header, Footer, ThermocoupleCard, EnvCard, VocQuality, HistoryChart, SerialConsole)
  lib/types.ts, voc.ts, socket.ts
.github/workflows/
  build-win.yml                  (push/PR main, publica artifact)
  release.yml                    (tag v*, build + publish release GitHub NSIS/Portable)
  release-linux.yml.DISABLED     (ORFÃO — Linux NÃO será suportado, arquivo deve ser apagado)
build/  icon.png / Logo_web-site.png
tests/parsers.node.cjs
```

### electron-builder atual — problemas encontrados
| Problema | Severidade | Ação |
|---|---|---|
| `build.publish[0].owner = Pat-termico` / `repo = Pat` | **CRÍTICO** | Mudar para owner=`Eva-ltda`, repo=`PAT` |
| `build.linux`, `build.deb`, `build.appImage`, `build.rpm`, `build.pacman` existem | **Indevido** (projeto exclusivo Windows) | **Remover do package.json** — Linux banido por requisito |
| `scripts.build:linux` / `build:all` / `--linux` existem | Indevido | Remover ou comentar? → **Remover** (não usar Linux) |
| `directories.output = "release/${os}"` | OK (no Windows gera `release/win`) | Manter |
| `win.target = [portable x64, nsis x64]` | OK | Manter |
| `nsis.artifactName = "${productName} Setup ${version}.${ext}"` | OK | Manter |
| `portable.artifactName = "${productName} ${version}.${ext}"` | OK | Manter |
| `productName: "Eva - Dashboard"` | ✅ Correto | Manter |
| `name: dashboard-arduino-scada` / `version: 1.1.12` | OK (version = source único) | Manter |
| `appId: com.pattermico.dashboard.arduino` | OK (compatibilidade userData) | Manter |

### electron-updater (configureAutoUpdater em main.cjs:770-829) — problemas encontrados
| Problema | Severidade | Ação |
|---|---|---|
| `autoDownload = true` + `update-available` mostra só "OK" sem pedir SIM/NÃO | **Média** | Mudar para `autoDownload = false`, mostrar diálogo com versão atual vs nova, botões SIM/NÃO; só baixa se SIM |
| `update-available` não informa `versão atual / nova versão` | **Baixa** | Preencher `detail` com `Versão atual: X, Nova versão: Y` |
| `update-downloaded` oferece só "Reiniciar agora / Depois" — OK | — | Manter |
| Eventos de progresso de download não são reportados para UI | **Baixa** | Opcional se houver evento `download-progress`; ao menos logar |
| Erros de update logados só no console | **Baixa** | Manter console.log como está |
| `autoUpdater.autoInstallOnAppQuit=true` | OK | Manter (se baixou, instala no fechamento) |

### Preload / IPC (preload.cjs:13-28)
| Problema | Severidade | Ação |
|---|---|---|
| Nenhum canal de IPC exposto para o renderer consultar / confirmar / reagir a atualizações | **Médio** | Adicionar no preload + ipcMain canais mínimos: `updater:checkNow`, `updater:getState`. → Ou manter só diálogo nativo main-process. **Escolha: manter diálogo no main** (mais seguro, menos código, não expõe Node pro React). |

### Janela / Menu / DevTools (main.cjs:699-753)
| Problema | Severidade | Ação |
|---|---|---|
| `Menu.setApplicationMenu(null)` global antes da janela | ✅ Já implementado | Manter |
| `autoHideMenuBar:true`, `menuBarVisible:false`, `win.removeMenu()` | ✅ Já feito | Manter |
| `devTools: !app.isPackaged` em `webPreferences` | ✅ OK | Manter |
| `devtools-opened` fecha em produção + bloqueia F12/Ctrl+Shift+I/J/C | ✅ Já feito | Manter |
| `titleBarStyle:"hiddenInset"` (custom sem barra) | OK | Manter |
| `title: "Eva - Dashboard"` | ✅ Correto | Manter |

### GitHub Actions
| Workflow | Problema | Ação |
|---|---|---|
| `build-win.yml` | `path: release/**` → agora `release/win/**` precisa bater | Atualizar `upload-artifact path` para `release/win/**`, já que output é `release/${os}`. |
| `release.yml` (release-win-tag) | Usa `--publish always`, GH_TOKEN=${{secrets.GITHUB_TOKEN}}. Publish owner/repo depende de package.json | Ajustar paths upload artifact para `release/win/**`; publicar release `owner=Eva-ltda repo=PAT` OK se package.json correto. |
| `release-linux.yml.DISABLED` | ORFÃO (projeto só Windows) | **Apagar arquivo** (Linux banido) |

### README.md
- Conteúdo atual curto. Precisa expandir e incluir: nome oficial EVA LTDA, requisitos Windows, instalação, uso, Arduino/protocolo, portas COM, sensores (MAX6675/BME680), exportação, backup, auto-update GitHub Releases, release flow, dev, build local, link oficial Eva-ltda/PAT.

### Arquivos a alterar / criar
| Arquivo | Ação |
|---|---|
| `.git/config` (remote) | Alterar origin URL via `git remote set-url` (não destrutivo) |
| `package.json` | Atualizar `build.publish owner/repo`; **remover bloco `linux`/`deb`/`appImage`/`rpm`/`pacman`**; remover `build:linux`, `build:all`, `build:renderer && electron-builder` scripts que envolvem Linux |
| `electron/main.cjs` configureAutoUpdater() | Mudar `autoDownload=false`; adicionar `update-available` com `SIM / NÃO`; mostrar versões |
| `.github/workflows/build-win.yml` | Corrigir upload-artifact path para `release/win/**` |
| `.github/workflows/release.yml` | Corrigir upload-artifact path para `release/win/**` |
| `.github/workflows/release-linux.yml.DISABLED` | **Apagar** (Linux banido) |
| `README.md` | Reescrever expandido |
| (opcional) remover arquivos órfãos Windows-build em Linux: | `BUILD-LINUX.sh` **apagar** |

---

## FASE 2 — Arquivos e Módulos
- `d:\PAT\package.json`: ajustes publish, remoção blocos Linux, remoção scripts Linux
- `d:\PAT\electron\main.cjs`: ajustes configureAutoUpdater (autoDownload=false, diálogo SIM/NÃO com versões)
- `.github/workflows/build-win.yml`: path upload-artifact → `release/win/**`
- `.github/workflows/release.yml`: path upload-artifact → `release/win/**`
- `.github/workflows/release-linux.yml.DISABLED`: DELETE
- `d:\PAT\BUILD-LINUX.sh`: DELETE (projeto exclusivo Windows)
- `d:\PAT\README.md`: reescrever expandido
- `git remote`: `git remote set-url origin https://github.com/Eva-ltda/PAT.git` (NÃO executa push, só prepara)

---

## FASE 3 — Implementation Steps (ordem)
1. **Git remote seguro (não destrutivo):** `git remote set-url origin https://github.com/Eva-ltda/PAT.git`. Verificar com `git remote -v`. NÃO FAZER push.
2. **package.json:**
   - Corrigir `build.publish[0].owner=Eva-ltda`, `repo=PAT`, `releaseType=release` (manter provider=github)
   - **Remover** blocos `build.linux`, `build.deb`, `build.appImage`, `build.rpm`, `build.pacman`
   - **Remover** scripts `build:linux` e `build:all` (deixar só `dev`, `build:renderer`, `build:win`, `lint`, `test`, `test:watch`). Trocar script `build` genérico por warning ou apagar (só deixar `build:win` oficial).
3. **electron/main.cjs configureAutoUpdater:**
   - `autoUpdater.autoDownload = false` (não baixa enquanto usuário não disser SIM)
   - Adicionar `autoUpdater.on("update-available", (info) => {...})` que abre `showMessageBox` com:
     - Título: "Nova versão disponível — Dashboard Arduino"
     - Mensagem: "Há uma nova versão do Dashboard Arduino."
     - Detail: `Versão atual: ${app.getVersion()}\nNova versão: ${info?.version || info?.updateInfo?.version || "—"}`
     - Botões: ["Sim", "Não"], `defaultId:0`, `cancelId:1`
     - `if (response === 0)` → `autoUpdater.downloadUpdate().catch(err => console.error(...))`
     - `if (response === 1)` → ignora e não baixa nada
   - Opcional: adicionar `autoUpdater.on("download-progress", (p) => console.log(...))`
   - Manter event `update-downloaded` (reiniciar agora / depois — já existente)
4. **GitHub Actions paths:**
   - `build-win.yml` passo "Upload artifacts" path `release/**` → `release/win/**`
   - `release.yml` passo "Upload artifacts (fallback)" path `release/**` → `release/win/**`
5. **Remover arquivos Linux:**
   - Apagar `.github/workflows/release-linux.yml.DISABLED`
   - Apagar `BUILD-LINUX.sh`
6. **README.md reescrever expandido** (tópicos do prompt item 26)
7. **Validações:**
   - `node --check electron/main.cjs`
   - `node --check electron/preload.cjs`
   - `node --check electron/lib/parsers.cjs`
   - `node --check tests/parsers.node.cjs`
   - `Get-Content package.json | ConvertFrom-Json` (JSON válido)
   - `npm run lint` (tsc --noEmit strict)
   - `npm run build:renderer`
   - Se tempo: `npm run test` (node --test parsers)

---

## Dependencies and Considerations
- **NÃO executar git reset, git clean, nem push** (requisito explícito).
- **Remoção blocos Linux não quebra Windows** — electron-builder só usa blocos do SO-alvo quando builda, mas remover reduz margem de erro futuro e cumpre requisito.
- `autoDownload=false` força o prompt SIM/NÃO que o requisito pede. O electron-updater baixa o `.exe` e o `.blockmap`; `latest.yml` só usa a tag correta se `publish.owner/repo` estiver certo.
- `secrets.GITHUB_TOKEN` no release.yml é **automático do GITHUB_TOKEN padrão** por run de Actions — só precisa que o package.json aponte para o repo/owner correto para o electron-builder publicar lá.
- userData depende de `appId` → manter `com.pattermico.dashboard.arduino` evita perda de backups/config dos clientes existentes.
- Ajustes de interface (auto-update UI do React) NÃO são necessários se mantivermos diálogos nativos do main — que é opção mais segura com `contextIsolation:true` e menos código.

---

## Validation
1. JSON package.json parse válido.
2. Sintaxe Node 4 arquivos .cjs.
3. `npm run lint` — 0 erros.
4. `npm run build:renderer` — build Vite sucesso.
5. `npm run test` parsers.node.cjs se disponível.
6. Verificar com `git remote -v` se origin = Eva-ltda/PAT.
7. Listar arquivos apagados (release-linux.yml.DISABLED, BUILD-LINUX.sh) realmente removidos.
8. Verificar package.json: nenhuma ocorrência de `deb`, `AppImage`, `rpm`, `pacman`, `linux.target`, `build:linux`.

---

## Risks
| Risco | Mitigação |
|---|---|
| Remoção `autoDownload=true` → usuários perdem atualizações automáticas se clicarem "Não". | Comportamento desejado pelo prompt item 6.5: escolher NÃO → não baixar. Se quiser receber depois, check periódico a cada 30 min já existe no timer. |
| Paths `release/win/**` novos em Actions → artifact upload pode falhar. | Se a pasta não existir (build falhou antes), `upload-artifact@v4` default não crasha com `if-no-files-found: warn`. Mas adicionar `if-no-files-found: warn` explicitamente para reduzir warnings pode ser bom. |
| Publish owner/repo errado em alguma linha residual. | Grep global por `Pat-termico` / `release-linux.yml.DISABLED` / `deb` no package.json após edição. |
| Apagar arquivos Linux → futuramente alguém pedir Linux de volta. | Prompt item 2 proíbe Linux explicitamente: "NÃO implementar Linux". Projeto fica mais limpo. |
| JSON malformado no package.json após editar. | Passo de validação obrigatório `ConvertFrom-Json`. |
