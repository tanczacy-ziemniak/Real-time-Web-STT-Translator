import { Bug, Trash2 } from "lucide-react";
import type { DebugLogEntry } from "../types";

interface DebugConsoleProps {
  logs: DebugLogEntry[];
  onClear: () => void;
}

export function DebugConsole({ logs, onClear }: DebugConsoleProps) {
  return (
    <section className="debug-panel" aria-label="Debug console">
      <div className="debug-header">
        <div className="panel-title">
          <Bug size={18} />
          <span>Debug Console</span>
        </div>

        <button className="icon-button" type="button" onClick={onClear} aria-label="Clear debug logs" title="Clear logs">
          <Trash2 size={17} />
        </button>
      </div>

      <div className="debug-log">
        {logs.length === 0 ? (
          <div className="empty-debug">No logs</div>
        ) : (
          logs.map((log) => (
            <div className={`debug-line ${log.level}`} key={log.id}>
              <span>{log.timestamp}</span>
              <p>{log.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
