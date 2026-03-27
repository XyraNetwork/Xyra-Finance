import React from 'react';

export const XyraLogo: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Official PNG Logo - No border or container */}
      <img 
        src="/xyra-logo.png" 
        alt="Xyra Finance" 
        style={{ 
          height: size,
          width: 'auto',
          objectFit: 'contain',
          filter: 'none'
        }}
      />
      <span 
        className="text-xl font-black tracking-[0.15em] text-white" 
        style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
      >
        XYRA
      </span>
    </div>
  );
};
