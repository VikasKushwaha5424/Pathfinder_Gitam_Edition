import React from 'react';

export default function PermissionsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="permissions-modal-overlay">
      <div className="permissions-modal">
        <h2>⚠️ Permission Denied</h2>
        <p>Maya needs Microphone and Location access to guide you across campus.</p>
        
        <div className="instructions">
          <p><strong>How to fix this:</strong></p>
          <ol>
            <li>Tap the <strong>aA</strong> or <strong>Lock</strong> icon in your browser's URL bar.</li>
            <li>Select <strong>Website Settings</strong> or <strong>Permissions</strong>.</li>
            <li>Set Microphone and Location to <strong>Allow</strong>.</li>
            <li>Refresh this page.</li>
          </ol>
        </div>
        
        <button className="primary-btn" onClick={() => window.location.reload()}>
          I've Fixed It (Refresh)
        </button>
        <button className="secondary-btn" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
