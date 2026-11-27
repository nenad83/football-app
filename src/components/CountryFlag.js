import React, { useState, useEffect } from 'react';

export default function CountryFlag({ country, size = 20, style = {}, className = "" }) {
  const width = size;
  const height = Math.round(size * 0.65);
  const normalizedCountry = (country || '').toLowerCase().trim();
  const [imgError, setImgError] = useState(false);

  // Reset error state if the country prop changes
  useEffect(() => {
    setImgError(false);
  }, [normalizedCountry]);

  const baseStyle = {
    borderRadius: '3px',
    overflow: 'hidden',
    border: '1.5px solid rgba(255, 255, 255, 0.2)',
    display: 'inline-block',
    verticalAlign: 'middle',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    width: `${width}px`,
    height: `${height}px`,
    objectFit: 'cover',
    transition: 'all 0.3s ease',
    ...style
  };

  if (!normalizedCountry) {
    return null;
  }

  // Capitalize the first letter of the country to match the filename convention: Flag_of_Country.svg
  const normalizedLower = normalizedCountry.toLowerCase();
  const customFlagPaths = {
    usa: "/flags/Flag_of_USA.svg",
    croatia: "/flags/Flago_of_Croatia.svg",
    fr_yugoslavia: "/flags/Flag_of_Yugoslavia_FR.svg",
    ussr: "/flags/Flag_of_the_Soviet_Union.svg"
  };
  const capitalizedCountry = normalizedCountry.charAt(0).toUpperCase() + normalizedCountry.slice(1);
  const flagPath = customFlagPaths[normalizedLower] || `/flags/Flag_of_${capitalizedCountry}.svg`;

  if (imgError) {
    // Premium text-based fallback placeholder
    const initials = normalizedCountry.slice(0, 2).toUpperCase();
    return (
      <div 
        className={className} 
        style={{
          ...baseStyle,
          background: 'linear-gradient(135deg, #2b303b, #1f232b)',
          color: '#00ff64',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.max(9, Math.round(height * 0.45))}px`,
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          textShadow: '0 0 4px rgba(0, 255, 100, 0.5)'
        }}
        title={country}
      >
        {initials}
      </div>
    );
  }

  return (
    <img 
      src={flagPath} 
      alt={`${country} flag`}
      className={className} 
      style={baseStyle} 
      onError={() => setImgError(true)}
    />
  );
}
