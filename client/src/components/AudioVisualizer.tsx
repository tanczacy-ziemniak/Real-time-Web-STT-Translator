import { Activity } from "lucide-react";
import { useAudioVisualizer } from "../hooks/useAudioVisualizer";

interface AudioVisualizerProps {
  stream: MediaStream | null;
}

export function AudioVisualizer({ stream }: AudioVisualizerProps) {
  const canvasRef = useAudioVisualizer(stream);

  return (
    <section className="visualizer-panel" aria-label="Microphone activity">
      <div className="panel-title">
        <Activity size={18} />
        <span>Input Level</span>
      </div>
      <canvas ref={canvasRef} className="visualizer" />
    </section>
  );
}
