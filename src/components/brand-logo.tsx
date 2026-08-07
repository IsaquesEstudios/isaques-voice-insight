import darkLogo from "@/assets/omniasyn-logo-dark.png.asset.json";
import lightLogo from "@/assets/omniasyn-logo-light.png.asset.json";
import { useTheme } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      src={theme === "dark" ? lightLogo.url : darkLogo.url}
      alt="Omniasyn"
      className={cn("h-7 w-auto object-contain", className)}
    />
  );
}
