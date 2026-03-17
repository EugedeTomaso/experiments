import { useState, useEffect } from "react";

export default function ConnectionBanner({ connectionState, onRetry }) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (connectionState !== "reconnecting") {
      setCountdown(60);
      return;
    }
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectionState]);

  if (connectionState === "connected" || connectionState === "connecting") {
    return null;
  }

  const isReconnecting = connectionState === "reconnecting";

  return (
    <div className={`connection-banner ${isReconnecting ? "warning" : "error"}`}>
      <span>
        {isReconnecting
          ? `Reconnecting... editing available for ${countdown}s`
          : "Disconnected — retrying automatically"}
      </span>
      <button className="connection-retry-btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
