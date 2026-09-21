export type SensorPayload = {
  t1: number | null;
  t2: number | null;
  t3: number | null;
  temp: number | null;
  hum: number | null;
  pressure: number | null;
  voc: number | null;
  vocPpm?: number | null;
  raw: string;
  ts: number;
  legacy?: boolean;
};

export type ConnectionStatus = {
  connected: boolean;
  collecting?: boolean;
  manualDisconnect?: boolean;
  sessionRows?: number;
  portPath?: string;
  manufacturer?: string;
  baudRate?: number;
  error?: string;
  lastSeenTs?: number;
};

export type SessionInfo = {
  rows: number;
  collecting: boolean;
  manualDisconnect: boolean;
  sessionJsonlPath?: string;
  startedAt?: number | null;
};
