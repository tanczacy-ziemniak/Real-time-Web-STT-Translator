import { useEffect, useRef } from "react";

export function useAudioVisualizer(stream: MediaStream | null) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream) {
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const context = canvas.getContext("2d");
    let animationFrame = 0;

    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    };

    const draw = () => {
      animationFrame = window.requestAnimationFrame(draw);
      if (!context) {
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#111827";
      context.fillRect(0, 0, width, height);

      const barCount = dataArray.length;
      const barWidth = Math.max(2, width / barCount);

      for (let index = 0; index < barCount; index += 1) {
        const value = dataArray[index] / 255;
        const barHeight = Math.max(2, value * height * 0.86);
        const hue = 168 + value * 38;
        context.fillStyle = `hsl(${hue}, 78%, ${48 + value * 22}%)`;
        context.fillRect(index * barWidth, height - barHeight, Math.max(1, barWidth - 1), barHeight);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      void audioContext.close();
    };
  }, [stream]);

  return canvasRef;
}
