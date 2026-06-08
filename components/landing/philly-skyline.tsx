export function PhillySkyline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMidYMax slice"
    >
      {/* Real Philadelphia skyline - recognizable landmarks left to right */}
      <g fill="currentColor">
        {/* Far left - residential / row homes */}
        <rect x="0" y="140" width="18" height="40" />
        <rect x="20" y="135" width="15" height="45" />
        <rect x="37" y="142" width="20" height="38" />
        <rect x="59" y="138" width="14" height="42" />

        {/* 30th Street Station - wide, low, classical */}
        <rect x="80" y="128" width="55" height="52" />
        <rect x="85" y="124" width="45" height="4" rx="1" />

        {/* Cira Centre - curved glass tower */}
        <rect x="142" y="75" width="22" height="105" rx="3" />

        {/* FMC Tower */}
        <rect x="170" y="65" width="18" height="115" />

        {/* BNY Mellon Center */}
        <rect x="195" y="52" width="24" height="128" />

        {/* One Liberty Place - iconic pointed spire */}
        <rect x="228" y="30" width="26" height="150" />
        <polygon points="228,30 241,8 254,30" />

        {/* Two Liberty Place - shorter pointed spire */}
        <rect x="258" y="42" width="22" height="138" />
        <polygon points="258,42 269,24 280,42" />

        {/* Three Logan Square */}
        <rect x="286" y="68" width="18" height="112" />

        {/* City Hall + William Penn statue - THE icon */}
        <rect x="312" y="55" width="38" height="125" />
        <rect x="316" y="48" width="30" height="7" />
        {/* Clock tower */}
        <rect x="324" y="22" width="14" height="26" />
        <rect x="326" y="18" width="10" height="4" />
        {/* William Penn statue */}
        <rect x="329" y="8" width="4" height="10" />
        <circle cx="331" cy="6" r="3" />

        {/* Comcast Center - tallest building */}
        <rect x="358" y="18" width="28" height="162" />

        {/* Comcast Technology Center - second tallest, with antenna */}
        <rect x="392" y="12" width="24" height="168" />
        <rect x="402" y="2" width="4" height="10" />

        {/* W/Element Hotel */}
        <rect x="422" y="58" width="16" height="122" />

        {/* Residences at the Ritz */}
        <rect x="444" y="72" width="18" height="108" />

        {/* Independence Hall area - lower, historic */}
        <rect x="472" y="120" width="40" height="60" />
        <rect x="480" y="114" width="24" height="6" />
        {/* Steeple */}
        <rect x="488" y="90" width="8" height="24" />
        <polygon points="488,90 492,78 496,90" />

        {/* Society Hill towers */}
        <rect x="520" y="68" width="16" height="112" />
        <rect x="540" y="72" width="16" height="108" />

        {/* Penn's Landing / Delaware waterfront */}
        <rect x="564" y="130" width="22" height="50" />
        <rect x="590" y="135" width="18" height="45" />

        {/* Ben Franklin Bridge towers */}
        <rect x="620" y="85" width="10" height="95" />
        <rect x="622" y="80" width="6" height="5" />
        {/* Bridge cables */}
        <path d="M625 85 Q 665 130 705 85" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M625 90 Q 665 135 705 90" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
        <rect x="700" y="85" width="10" height="95" />
        <rect x="702" y="80" width="6" height="5" />

        {/* Camden waterfront hint */}
        <rect x="730" y="140" width="20" height="40" />
        <rect x="755" y="145" width="15" height="35" />
        <rect x="775" y="148" width="25" height="32" />
      </g>
    </svg>
  );
}
