"use client";

/**
 * The pill-shaped collapse handle used on every screen that has a panel worth hiding — the
 * Dashboard's sidebar, Best Frame's camera list, Redmap's results panel. It was copied
 * verbatim into two files before this; one shape, one place.
 *
 * The pill is flat on its left edge and rounded on its right, so it reads as a tab attached to
 * whatever sits to its left and bulging into the space on its right. Mirror it with
 * `scaleX(-1)` when the panel is on the other side. The triangle points the way the panel will
 * move: left while expanded (collapse), right while collapsed (expand).
 *
 * Note the shape starts at x=3 inside a 34px viewBox — that margin is room for the drop shadow.
 * Callers offset by -3px so the gap doesn't show as a sliver of whatever is behind it.
 */
export default function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  // Right-pointing triangle = "펼치기" (expand, shown while collapsed); left-pointing = "접기"
  // (collapse, shown while expanded) — same box+shadow shell either way, just the triangle flips.
  const trianglePath = collapsed ? "M19 29L13 23.8038L13 34.1962L19 29Z" : "M11 29L17 23.8038L17 34.1962L11 29Z";
  const filterId = collapsed ? "sidebar-toggle-shadow-expand" : "sidebar-toggle-shadow-collapse";
  return (
    <svg width="34" height="62" viewBox="0 0 34 62" fill="none">
      <g filter={`url(#${filterId})`}>
        <path d="M3 1H19C25.6274 1 31 6.37258 31 13V45C31 51.6274 25.6274 57 19 57H3V1Z" fill="white"/>
        <path d={trianglePath} fill="var(--gray-600)"/>
      </g>
      <defs>
        <filter id={filterId} x="0" y="0" width="34" height="62" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dy="2"/>
          <feGaussianBlur stdDeviation="1.5"/>
          <feComposite in2="hardAlpha" operator="out"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0"/>
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
        </filter>
      </defs>
    </svg>
  );
}
