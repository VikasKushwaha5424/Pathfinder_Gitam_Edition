export default function ClassStatus({ currentClass, nextClass, minsToNext, onNavigate, onDismiss }) {
  if (!currentClass && !nextClass) return null;

  if (currentClass) {
    return (
      <div className="class-status active">
        <span className="class-dot active" />
        <span className="class-info">
          <strong>{currentClass.subject}</strong> — {currentClass.room}
        </span>
        <button className="class-nav-btn" onClick={() => onNavigate(currentClass.location)}>Go</button>
        <button className="class-dismiss-btn" onClick={onDismiss}>✕</button>
      </div>
    );
  }

  if (nextClass && minsToNext <= 30) {
    return (
      <div className={`class-status upcoming ${minsToNext <= 5 ? 'urgent' : ''}`}>
        <span className="class-dot upcoming" />
        <span className="class-info">
          <strong>{nextClass.subject}</strong> in <strong>{minsToNext} min</strong> @ {nextClass.room}
        </span>
        <button className="class-nav-btn" onClick={() => onNavigate(nextClass.location)}>Go</button>
        <button className="class-dismiss-btn" onClick={onDismiss}>✕</button>
      </div>
    );
  }

  return null;
}
