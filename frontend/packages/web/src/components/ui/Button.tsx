interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

const VARIANT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-purple-600 hover:bg-purple-500 text-white",
  secondary: "bg-gray-700 hover:bg-gray-600 text-gray-200",
  danger: "bg-red-700 hover:bg-red-600 text-white",
  ghost: "bg-transparent hover:bg-gray-800 text-gray-300",
};

const SIZE: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {children}
    </button>
  );
}
