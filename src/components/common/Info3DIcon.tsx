import React, { useId } from "react";

interface Info3DIconProps {
  size?: number;
  className?: string;
}

export const Info3DIcon: React.FC<Info3DIconProps> = ({ size = 20, className = "" }) => {
  const uid = useId().replace(/:/g, "_");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 transition-transform duration-200 select-none ${className}`}
      style={{ filter: "drop-shadow(0 2px 4px rgba(37, 99, 235, 0.35))" }}
    >
      <defs>
        {/* 3D Sphere Radial Gradient (Key Light top-left) */}
        <radialGradient
          id={`info3d_bg_${uid}`}
          cx="32%"
          cy="28%"
          r="72%"
          fx="26%"
          fy="22%"
        >
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="28%" stopColor="#3b82f6" />
          <stop offset="68%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>

        {/* 3D Glossy Specular Sheen (Curved highlight) */}
        <linearGradient
          id={`info3d_gloss_${uid}`}
          x1="0%"
          y1="0%"
          x2="50%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* 3D Outer Rim Bevel */}
        <linearGradient
          id={`info3d_rim_${uid}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#2563eb" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.7" />
        </linearGradient>

        {/* Inner Shadow for Embossed "i" */}
        <filter id={`info3d_shadow_${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.6" floodColor="#0f172a" floodOpacity="0.65" />
        </filter>
      </defs>

      {/* Main 3D Sphere Body */}
      <circle
        cx="16"
        cy="16"
        r="14"
        fill={`url(#info3d_bg_${uid})`}
        stroke={`url(#info3d_rim_${uid})`}
        strokeWidth="1.2"
      />

      {/* Specular 3D Gloss Reflection at Upper Left */}
      <ellipse
        cx="14"
        cy="9.5"
        rx="8.5"
        ry="4"
        fill={`url(#info3d_gloss_${uid})`}
      />

      {/* Subtle Bottom Ambient Bounce Light */}
      <path
        d="M 6 20 C 9 26, 23 26, 26 20"
        stroke="#93c5fd"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* 3D "i" Dot */}
      <circle
        cx="16"
        cy="10.5"
        r="1.9"
        fill="#ffffff"
        filter={`url(#info3d_shadow_${uid})`}
      />

      {/* 3D "i" Stem */}
      <rect
        x="14.2"
        y="14.2"
        width="3.6"
        height="8.2"
        rx="1.8"
        fill="#ffffff"
        filter={`url(#info3d_shadow_${uid})`}
      />
    </svg>
  );
};
