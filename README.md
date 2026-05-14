# Dashboard Arduino

Aplicativo desktop (Windows) para monitoramento industrial em tempo real de sensores conectados a Arduino via Serial USB (COM). O foco do projeto é oferecer uma interface moderna, responsiva e “de chão de fábrica”, com leitura contínua, histórico e exportação de dados.

## Principais recursos

- Monitoramento em tempo real com status de conexão e indicação de erros.
- Seleção manual de porta serial (COM) pela interface, com listagem de portas disponíveis.
- Compatível com dados enviados como CSV e também com linhas “humanas” do Arduino.
- Histórico de medições e exportação em CSV compatível com Excel.
- Distribuição em Windows como instalador (NSIS) e executável portátil (portable), sem dependência de Wi‑Fi para rodar localmente.

## Dados monitorados

O dashboard trabalha com as seguintes variáveis (quando disponíveis):

- T1, T2, T3 (termopares)
- TA (temperatura ambiente)
- U (umidade)
- hPa (pressão)
- VOC (qualidade de ar/gases)

## Arquitetura (visão geral)

- Electron (processo principal): gerencia a conexão serial, faz parsing dos dados e publica eventos para a UI.
- Preload (contextBridge): expõe uma API segura para o renderer (listar portas, selecionar porta, exportar CSV).
- React + Vite + Tailwind: camada de visualização do dashboard e componentes.
- Socket.IO local: canal de eventos em tempo real entre o processo principal e a interface.
- serialport: integração com portas COM no Windows.

## Build e entrega

O build do Windows é realizado por `electron-builder` e também via GitHub Actions (workflow `build-windows`), que publica os executáveis como artifact em `.zip` (conteúdo gerado em `release/`).

## Identidade visual

O ícone do aplicativo é configurado via `build/icon.png` no `package.json`.
