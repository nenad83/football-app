import React from 'react';
import { resolveNationality } from '../utils/nationalities';

/**
 * Crisp flag component backed by `flag-icons` (https://flagicons.lipis.dev/).
 */
export default function NationFlag({ nation, size = 18, showName = false, style = {}, nameStyle = {} }) {
  const resolved = resolveNationality(nation);
  if (!resolved) return null;

  const width = size;
  const height = Math.round(size * 0.75);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
      {resolved.code ? (
        <span
          className={`fi fi-${resolved.code}`}
          title={resolved.name}
          aria-label={resolved.name}
          style={{
            display: 'inline-block',
            width: `${width}px`,
            height: `${height}px`,
            borderRadius: '2px',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            flexShrink: 0,
            backgroundSize: 'cover',
            ...style
          }}
        />
      ) : (
        <span style={{ fontSize: '12px' }} title={resolved.name}>🏳️</span>
      )}
      {showName && (
        <span style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 600, ...nameStyle }}>
          {resolved.name}
        </span>
      )}
    </span>
  );
}
