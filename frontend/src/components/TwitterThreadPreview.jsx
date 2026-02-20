export function TwitterThreadPreview({ tweets }) {
  if (!tweets || tweets.length === 0) return null;

  return (
    <div className="tweet-thread-preview">
      <div style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 4 }}>
        {tweets.length} {tweets.length === 1 ? "tweet" : "tweets"} in thread
      </div>
      {tweets.map((tweet, i) => (
        <div key={i} className="tweet-card">
          <div className="tweet-card-text">{tweet.text}</div>
          <div className="tweet-card-meta">
            <span>Tweet {i + 1}</span>
            <span className={`tweet-char-count${tweet.char_count > 280 ? " over-limit" : ""}`}>
              {tweet.char_count}/280
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
