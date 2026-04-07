interface BadgeProps {
  label: string;
  color?: "purple" | "blue" | "green" | "yellow" | "red" | "gray";
  "data-testid"?: string;
}

const COLOR_MAP: Record<NonNullable<BadgeProps["color"]>, string> = {
  purple: "bg-purple-900/60 text-purple-300",
  blue: "bg-blue-900/60 text-blue-300",
  green: "bg-green-900/60 text-green-300",
  yellow: "bg-yellow-900/60 text-yellow-300",
  red: "bg-red-900/60 text-red-300",
  gray: "bg-gray-800 text-gray-400",
};

export function Badge({ label, color = "gray", "data-testid": testId }: BadgeProps) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${COLOR_MAP[color]}`}
      data-testid={testId}
    >
      {label}
    </span>
  );
}
