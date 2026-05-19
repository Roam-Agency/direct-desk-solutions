/**
 * Direct Desk Solutions wordmark + arrow icon.
 * Used in the public header, the placeholder homepage, and any
 * future surfaces that need the brand mark inline (sticky CTAs,
 * condition report footers, email templates).
 */

type LogoProps = {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
};

export default function Logo({
  size = 32,
  variant = "dark",
  className = "",
}: LogoProps) {
  const textFill = variant === "light" ? "#fff" : "#0A0A0A";
  const innerArrowFill = variant === "light" ? "#000" : "#FAFAF7";
  const aspectRatio = 340 / 110;
  const width = size * aspectRatio;

  return (
    <svg
      viewBox="0 0 340 110"
      width={width}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Direct Desk Solutions"
      className={className}
    >
      <polygon points="5,10 100,55 5,100 25,55" fill="#E5202A" />
      <polygon points="25,55 60,55 45,75" fill={innerArrowFill} />
      <text
        x="115"
        y="68"
        fontFamily="var(--font-archivo-black), var(--font-archivo), system-ui, sans-serif"
        fontSize="58"
        fontWeight="900"
        fill={textFill}
        fontStyle="italic"
      >
        Direct
      </text>
      <text
        x="115"
        y="98"
        fontFamily="var(--font-archivo), system-ui, sans-serif"
        fontSize="20"
        fontWeight="800"
        letterSpacing="3"
        fill={textFill}
      >
        DESK SOLUTIONS
      </text>
    </svg>
  );
}
