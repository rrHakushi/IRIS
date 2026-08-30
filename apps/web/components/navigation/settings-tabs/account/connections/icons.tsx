"use client";

import React from "react";

interface ProviderIconProps extends React.SVGProps<SVGSVGElement> {
  provider: string;
  className?: string;
}

export function ProviderIcon({
  provider,
  className = "w-6 h-6",
  ...props
}: ProviderIconProps): React.JSX.Element {
  const p = provider.toUpperCase();

  switch (p) {
    case "ANILIST":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path
            d="M6.36 2H2v20h4.36V2zm5.72 8.73h4.36V22h-4.36v-11.27zM22 2h-4.36v20H22V2z"
            fill="#02A9FF"
          />
          <path
            d="M12.08 2L6.36 12.73h5.72V2zm5.56 0h-4.36l5.72 10.73V2z"
            fill="#02A9FF"
          />
        </svg>
      );

    case "MAL":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path d="M2.5 7.5v9h2.25v-5.25l2.25 3.5 2.25-3.5V16.5h2.25v-9H9.25L7 11.25 4.75 7.5H2.5zm10 0v9h2.25v-3.75h2.5v-1.75h-2.5V9.25h3v-1.75h-5.25zm6.5 0v9h5.25v-1.75h-3v-7.25H19z" />
        </svg>
      );

    case "SIMKL":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z" />
        </svg>
      );

    case "BANGUMI":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15h-2v-4h2v4zm0-6h-2V7h2v4zm4 6h-2v-4h2v4zm0-6h-2V7h2v4zm4 6h-2v-4h2v4zm0-6h-2V7h2v4z" />
        </svg>
      );

    case "STEAM":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path d="M12 2a10 10 0 0 0-10 10c0 4.7 3.25 8.64 7.66 9.68l2.9-4.22a3.5 3.5 0 0 1-.31-1.46c0-.35.06-.68.16-1l-3.3-2.38a2.5 2.5 0 1 1 3.5-3.32l2.38 3.3c.32-.1.65-.16 1-.16 1.93 0 3.5 1.57 3.5 3.5 0 1.93-1.57 3.5-3.5 3.5-.6 0-1.16-.16-1.65-.43l-4.14 2.85A10 10 0 1 0 12 2zm0 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
      );

    case "RIOT_GAMES":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="#D13639"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path d="M2.5 8.5l3.2-4.5h12.6l3.2 4.5-9.5 13-9.5-13zm4.2 1.5l5.3 7.2 5.3-7.2H6.7z" />
        </svg>
      );

    case "RADARR":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="#FFC230"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z" />
        </svg>
      );

    case "SONARR":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="#00CDF0"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          {...props}
        >
          <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zm-9-2c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0-8c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
        </svg>
      );

    default:
      return (
        <div
          className={`rounded-xl flex items-center justify-center font-bold text-white shadow-sm text-xs ${className}`}
          style={{ backgroundColor: "#3B82F6" }}
        >
          {provider.slice(0, 2).toUpperCase()}
        </div>
      );
  }
}
