import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { TranscriptEntry } from "../types";

interface TranscriptLogProps {
  entries: TranscriptEntry[];
  interimTranscript: string;
}

function StatusIcon({ status }: { status: TranscriptEntry["status"] }) {
  if (status === "done") {
    return <CheckCircle2 size={17} className="status-done" aria-label="Done" />;
  }

  if (status === "error") {
    return <XCircle size={17} className="status-error" aria-label="Error" />;
  }

  return <Clock3 size={17} className="status-pending" aria-label="Pending" />;
}

export function TranscriptLog({ entries, interimTranscript }: TranscriptLogProps) {
  return (
    <section className="transcript-panel" aria-label="Transcript log">
      <div className="interim-line">{interimTranscript ? `Listening: ${interimTranscript}` : "Listening"}</div>

      <div className="transcript-list">
        {entries.length === 0 ? (
          <div className="empty-state">No transcript yet</div>
        ) : (
          entries.map((entry) => (
            <article className="transcript-entry" key={entry.id}>
              <header>
                <time>{entry.timestamp}</time>
                <StatusIcon status={entry.status} />
              </header>

              <p className="original-text">{entry.originalText}</p>

              <p className={entry.status === "error" ? "translated-text error-text" : "translated-text"}>
                {entry.status === "pending" ? "Translating..." : entry.translatedText || entry.error}
              </p>

              {entry.status === "done" && typeof entry.elapsedMs === "number" ? (
                <footer>
                  {entry.targetLanguage} / {entry.elapsedMs}ms
                </footer>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
