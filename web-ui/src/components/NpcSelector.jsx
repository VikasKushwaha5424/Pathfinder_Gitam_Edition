

export default function NpcSelector({ npcDetails, activeNpc, onSelect }) {
  return (
    <>
      <h3>Target Identity</h3>
      <div className="npc-selector" role="tablist" aria-label="Select NPC">
        {Object.keys(npcDetails).map((npcKey) => (
          <button
            key={npcKey}
            role="tab"
            aria-selected={activeNpc === npcKey}
            className={`tab-button ${activeNpc === npcKey ? 'active' : ''}`}
            style={{ borderLeftColor: activeNpc === npcKey ? npcDetails[npcKey].color : 'transparent' }}
            onClick={() => onSelect(npcKey)}
          >
            {npcDetails[npcKey].name}
          </button>
        ))}
      </div>
    </>
  );
}
