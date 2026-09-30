# Prompt

Use this SVG:

<svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
  <!-- Drafting Construction Lines Overshooting the squircle boundaries -->
  <line x1="8" y1="20" x2="120" y2="20" stroke-width="1" stroke-dasharray="3 4" opacity="0.3"/>
  <line x1="8" y1="108" x2="120" y2="108" stroke-width="1" stroke-dasharray="3 4" opacity="0.3"/>
  <line x1="20" y1="8" x2="20" y2="120" stroke-width="1" stroke-dasharray="3 4" opacity="0.3"/>
  <line x1="108" y1="8" x2="108" y2="120" stroke-width="1" stroke-dasharray="3 4" opacity="0.3"/>

  <!-- Main Squircle Outline with Drafting Corner Arc Blends -->
  <rect x="20" y="20" width="88" height="88" rx="22" stroke-width="2.6"/>

  <!-- Corner drafting tick marks indicating radius centers -->
  <line x1="36" y1="14" x2="36" y2="26" stroke-width="1.6" opacity="0.6"/>
  <line x1="92" y1="14" x2="92" y2="26" stroke-width="1.6" opacity="0.6"/>
  <line x1="36" y1="102" x2="36" y2="114" stroke-width="1.6" opacity="0.6"/>
  <line x1="92" y1="102" x2="92" y2="114" stroke-width="1.6" opacity="0.6"/>

  <!-- Center Construction Hub -->
  <circle cx="64" cy="64" r="3.5" stroke-width="2" fill="white"/>
  <circle cx="64" cy="64" r="1.5" fill="currentColor"/>

  <!-- NODE 1 (Top / Proposal Arrow) -->
  <g transform="translate(64, 20)">
    <circle cx="0" cy="0" r="12" stroke-width="2.4" fill="white"/>
    <path d="M -4 -4 L 4 0 L -4 4" stroke-width="2.4" stroke-linejoin="round"/>
    <line x1="-7" y1="0" x2="2" y2="0" stroke-width="2.2"/>
  </g>

  <!-- NODE 2 (Right / Spec Doc) -->
  <g transform="translate(108, 64)">
    <circle cx="0" cy="0" r="12" stroke-width="2.4" fill="white"/>
    <rect x="-5" y="-6.5" width="10" height="13" rx="1.5" stroke-width="2"/>
    <line x1="-2.5" y1="-2.5" x2="2.5" y2="-2.5" stroke-width="1.8"/>
    <line x1="-2.5" y1="0.5" x2="2.5" y2="0.5" stroke-width="1.8"/>
    <line x1="-2.5" y1="3.5" x2="0.5" y2="3.5" stroke-width="1.8"/>
  </g>

  <!-- NODE 3 (Bottom / Delta) -->
  <g transform="translate(64, 108)">
    <circle cx="0" cy="0" r="12" stroke-width="2.4" fill="white"/>
    <path d="M 0 -5.5 L 5.5 4 L -5.5 4 Z" stroke-width="2.2" stroke-linejoin="round"/>
  </g>

  <!-- NODE 4 (Left / Code) -->
  <g transform="translate(20, 64)">
    <circle cx="0" cy="0" r="12" stroke-width="2.4" fill="white"/>
    <path d="M -4.5 -3.5 L -1 0 L -4.5 3.5" stroke-width="2.2" stroke-linejoin="round"/>
    <line x1="1.5" y1="3.5" x2="5" y2="3.5" stroke-width="2.2"/>
  </g>
</svg>
