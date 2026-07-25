import { useMemo, useState } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Country name in PT-BR (fallback to English display name via Intl)
const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["pt-BR"], { type: "region" })
    : null;

// Flag emoji from ISO country code (regional indicator symbols)
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) =>
      String.fromCodePoint(127397 + c.charCodeAt(0)),
    );
}

const PRIORITY: CountryCode[] = ["BR", "US", "PT", "AR", "MX", "ES", "GB"];

interface CountryOption {
  code: CountryCode;
  name: string;
  dial: string;
}

function buildCountries(): CountryOption[] {
  const all = getCountries().map<CountryOption>((code) => ({
    code,
    name: displayNames?.of(code) ?? code,
    dial: `+${getCountryCallingCode(code)}`,
  }));
  const priority = PRIORITY.map((c) => all.find((x) => x.code === c)).filter(
    (x): x is CountryOption => !!x,
  );
  const rest = all
    .filter((c) => !PRIORITY.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return [...priority, ...rest];
}

interface Props {
  value: string; // E.164 (+5511...)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  defaultCountry?: CountryCode;
}

export function PhoneNumberInput({
  value,
  onChange,
  placeholder,
  className,
  defaultCountry = "BR",
}: Props) {
  const countries = useMemo(buildCountries, []);

  // Derive country from current value; fallback to default.
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  const [country, setCountry] = useState<CountryCode>(
    parsed?.country ?? defaultCountry,
  );
  const [open, setOpen] = useState(false);

  const dial = `+${getCountryCallingCode(country)}`;
  const nationalRaw = parsed?.country === country ? parsed.nationalNumber : "";
  const formatted = nationalRaw
    ? new AsYouType(country).input(nationalRaw)
    : "";

  const [display, setDisplay] = useState(formatted);

  // Keep display in sync when parent value changes externally.
  useMemo(() => {
    if (parsed?.country === country) {
      setDisplay(new AsYouType(country).input(parsed.nationalNumber));
    } else if (!value) {
      setDisplay("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleCountry = (c: CountryCode) => {
    setCountry(c);
    setOpen(false);
    const digits = display.replace(/\D/g, "");
    if (digits) {
      const next = new AsYouType(c).input(digits);
      setDisplay(next);
      const e164 = parsePhoneNumberFromString(next, c)?.number ?? `+${getCountryCallingCode(c)}${digits}`;
      onChange(e164);
    } else {
      onChange("");
    }
  };

  const handleInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const next = new AsYouType(country).input(digits);
    setDisplay(next);
    if (!digits) {
      onChange("");
      return;
    }
    const parsedNext = parsePhoneNumberFromString(next, country);
    onChange(parsedNext?.number ?? `+${getCountryCallingCode(country)}${digits}`);
  };

  const current = countries.find((c) => c.code === country);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 shrink-0 gap-1.5 border-white/[0.08] bg-background/40 px-2 text-xs backdrop-blur-xl"
          >
            <span className="text-base leading-none">{flagEmoji(country)}</span>
            <span className="font-mono">{dial}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] border-white/[0.08] bg-card/90 p-0 backdrop-blur-2xl">
          <Command>
            <CommandInput placeholder="Buscar país..." className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {countries.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.dial} ${c.code}`}
                    onSelect={() => handleCountry(c.code)}
                    className="gap-2 text-xs"
                  >
                    <span className="text-base leading-none">
                      {flagEmoji(c.code)}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="font-mono text-muted-foreground">
                      {c.dial}
                    </span>
                    <Check
                      className={cn(
                        "h-3.5 w-3.5",
                        country === c.code ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        value={display}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder ?? (current ? `Número em ${current.name}` : "Número")}
        inputMode="tel"
        autoComplete="tel-national"
        className="h-8 border-white/[0.08] bg-background/40 font-mono text-xs backdrop-blur-xl"
      />
    </div>
  );
}
