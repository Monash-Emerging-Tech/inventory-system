import { useState } from "react";
import { trpc } from "@/client/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, Pencil, Search, Tag } from "lucide-react";
import {
  dedupeFilamentColors,
  filamentTypeMatches,
} from "@/lib/filamentColors";

export function ColorSwatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block w-4 h-4 rounded-sm border border-border/50 shrink-0"
      style={{ backgroundColor: `#${hex.slice(0, 6)}` }}
    />
  );
}

export interface FilamentColorCandidate {
  printerId: number;
  printerName: string;
  amsId: number;
  trayId: number;
  colorHex: string | null;
  colorName: string | null;
  material: string;
  remaining: number;
}

type FilamentSelection =
  | { mode: "any" }
  | { mode: "color"; colorHex: string; colorName?: string | null };

// The exact filament colour picker used when queuing a print (dedupe by
// colour, unknown-tray grouping, edit-colour pencil, "Can't find your
// filament?" flow) - reused anywhere a user needs to pick a filament colour,
// including resolving a filament-short warning on the print queue.
export function FilamentColorPicker({
  type,
  candidates,
  loading,
  emptyMessage,
  showAnyOption = true,
  selected,
  onSelectAny,
  onSelectColor,
  onColorsChanged,
}: {
  type: string;
  candidates: FilamentColorCandidate[];
  loading?: boolean;
  emptyMessage: string;
  showAnyOption?: boolean;
  selected: FilamentSelection;
  onSelectAny: () => void;
  onSelectColor: (candidate: FilamentColorCandidate) => void;
  onColorsChanged?: () => void;
}) {
  const isColorSelected = selected.mode === "color";
  const { known, unknown } = dedupeFilamentColors(
    candidates.filter((c) => filamentTypeMatches(c.material, type)),
    (c) => c.colorHex,
    (c) => c.colorName,
    (c) => c.remaining,
  );

  interface NamingLocation {
    printerId: number;
    printerName: string;
    amsId: number;
    trayId: number;
  }

  const [namingTarget, setNamingTarget] = useState<{
    filamentType: string;
    hex: string;
    locations: NamingLocation[];
    editableType: boolean;
  } | null>(null);
  const [namingLocationIdx, setNamingLocationIdx] = useState(0);
  const [namingTypeInput, setNamingTypeInput] = useState("");
  const [namingNameInput, setNamingNameInput] = useState("");
  const [namingHexInput, setNamingHexInput] = useState("");
  const [locationSelectOpen, setLocationSelectOpen] = useState(false);

  const [findFilamentOpen, setFindFilamentOpen] = useState(false);
  const [findPrinterId, setFindPrinterId] = useState<number | null>(null);

  const { data: printers } = trpc.printQueue.listPrinters.useQuery();
  const findPrinterAmsQuery = trpc.printQueue.getPrinterAms.useQuery(
    { printerId: findPrinterId! },
    { enabled: findFilamentOpen && findPrinterId != null },
  );

  function formatSlotLabel(loc: NamingLocation): string {
    return loc.amsId === 255
      ? `External Spool ${loc.trayId + 1}`
      : `AMS${loc.amsId}`;
  }

  const nameFilamentColorMutation =
    trpc.printQueue.nameFilamentColor.useMutation({
      onSuccess: () => {
        toast.success("Colour saved");
        void utils.printQueue.getPrinterAms.invalidate();
        onColorsChanged?.();
        setNamingTarget(null);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to save colour");
      },
    });
  const utils = trpc.useUtils();

  function openNamingPopup(
    filamentType: string,
    hex: string,
    currentName: string | null,
  ) {
    const normalizedHex = hex.slice(0, 6).toUpperCase();
    const locations: NamingLocation[] = candidates
      .filter((c) => filamentTypeMatches(c.material, filamentType))
      .filter(
        (c) => (c.colorHex ?? "").slice(0, 6).toUpperCase() === normalizedHex,
      )
      .map((c) => ({
        printerId: c.printerId,
        printerName: c.printerName,
        amsId: c.amsId,
        trayId: c.trayId,
      }));

    setNamingTarget({
      filamentType,
      hex: normalizedHex,
      locations,
      editableType: false,
    });
    setNamingLocationIdx(0);
    setNamingTypeInput(filamentType);
    setNamingNameInput(currentName ?? "");
    setNamingHexInput(normalizedHex);
    setLocationSelectOpen(false);
  }

  function openUnknownNamingPopup(
    filamentType: string,
    locations: NamingLocation[],
  ) {
    setNamingTarget({
      filamentType,
      hex: "",
      locations,
      editableType: false,
    });
    setNamingLocationIdx(-1);
    setNamingTypeInput(filamentType);
    setNamingNameInput("");
    setNamingHexInput("");
    setLocationSelectOpen(locations.length > 1);
  }

  function openFindFilamentPopup(
    location: NamingLocation,
    current: { type: string; hex: string; colorName: string | null } | null,
  ) {
    const normalizedHex = (current?.hex ?? "").slice(0, 6).toUpperCase();
    setNamingTarget({
      filamentType: current?.type ?? "",
      hex: normalizedHex,
      locations: [location],
      editableType: true,
    });
    setNamingLocationIdx(0);
    setNamingTypeInput(current?.type ?? "");
    setNamingNameInput(current?.colorName ?? "");
    setNamingHexInput(normalizedHex);
    setLocationSelectOpen(false);
  }

  function formatUnknownLocations(locations: NamingLocation[]): string {
    const byPrinter = new Map<number, { name: string; amsIds: number[] }>();
    for (const loc of locations) {
      const entry = byPrinter.get(loc.printerId) ?? {
        name: loc.printerName,
        amsIds: [],
      };
      if (!entry.amsIds.includes(loc.amsId)) entry.amsIds.push(loc.amsId);
      byPrinter.set(loc.printerId, entry);
    }
    return [...byPrinter.values()]
      .map(
        (e) =>
          `${e.name}-AMS${[...e.amsIds].sort((a, b) => a - b).join(",AMS")}`,
      )
      .join(", ");
  }

  function submitNamingPopup() {
    if (!namingTarget) return;
    const location = namingTarget.locations[namingLocationIdx];
    if (!location) return;
    const submittedType = namingTarget.editableType
      ? namingTypeInput.trim()
      : namingTarget.filamentType;
    if (!submittedType || !namingNameInput.trim() || !namingHexInput.trim())
      return;

    nameFilamentColorMutation.mutate({
      printerId: location.printerId,
      amsId: location.amsId,
      trayId: location.trayId,
      filamentType: submittedType,
      colorHex: namingHexInput.trim(),
      colorName: namingNameInput.trim(),
    });
  }

  const unknownLocations: NamingLocation[] = unknown.map((c) => ({
    printerId: c.printerId,
    printerName: c.printerName,
    amsId: c.amsId,
    trayId: c.trayId,
  }));

  return (
    <>
      {loading ? (
        <p className="text-xs text-muted-foreground">
          Loading available colours…
        </p>
      ) : known.length === 0 && unknown.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {showAnyOption && (
            <button
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                !isColorSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
              onClick={onSelectAny}
            >
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm border-2 border-dashed border-current opacity-50 shrink-0" />
              <span>Any {type}</span>
              {!isColorSelected && <Check className="h-3.5 w-3.5 ml-auto" />}
            </button>
          )}

          <div className="grid grid-cols-1 gap-0.5 max-h-40 overflow-y-auto">
            {known.map((c, i) => {
              const hex = (c.colorHex ?? "").slice(0, 6).toUpperCase();
              const selectedHex = (
                selected.mode === "color" ? selected.colorHex : ""
              )
                .slice(0, 6)
                .toUpperCase();
              const isSelected = isColorSelected && hex === selectedHex;

              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors min-w-0 cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => onSelectColor(c)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    onSelectColor(c);
                  }}
                >
                  {hex ? (
                    <ColorSwatch hex={hex} />
                  ) : (
                    <span className="w-4 h-4 rounded-sm border border-dashed border-border shrink-0" />
                  )}
                  <span className="flex-1 text-left min-w-0 overflow-hidden">
                    <span className="block truncate">
                      {c.colorName} - {c.material}
                    </span>
                    <span className="block truncate text-xs opacity-70">
                      {c.printerName}
                    </span>
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  <button
                    type="button"
                    title="Edit colour"
                    className={`shrink-0 p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 ${
                      isSelected ? "" : "text-muted-foreground"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openNamingPopup(c.material, hex, c.colorName);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {unknown.length > 0 && (
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm min-w-0">
                <span className="w-4 h-4 rounded-sm border border-dashed border-border shrink-0" />
                <span className="flex-1 text-left min-w-0 overflow-hidden">
                  <span className="block truncate">
                    {unknown.length} Unknown Filament
                    {unknown.length === 1 ? "" : "s"}
                  </span>
                  <span className="block truncate text-xs opacity-50">
                    {formatUnknownLocations(unknownLocations)}
                  </span>
                </span>
                <button
                  type="button"
                  title="Name these colours"
                  className="shrink-0 flex items-center gap-1 rounded-sm bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                  onClick={() => openUnknownNamingPopup(type, unknownLocations)}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Choose Colour
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors mt-2"
        onClick={() => setFindFilamentOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        Can't find your filament?
      </button>

      {/* Naming / colour-editing popup */}
      <Dialog
        open={namingTarget != null}
        onOpenChange={(o) => {
          if (!o) setNamingTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {namingTarget && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {namingLocationIdx >= 0
                    ? `Configuring ${namingTarget.locations[namingLocationIdx]?.printerName ?? "printer"} ${formatSlotLabel(namingTarget.locations[namingLocationIdx])}`
                    : "Select a printer / slot"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {namingTarget.locations.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>Printer / slot</Label>
                    <Select
                      value={
                        namingLocationIdx >= 0
                          ? String(namingLocationIdx)
                          : undefined
                      }
                      onValueChange={(v) => setNamingLocationIdx(Number(v))}
                      open={locationSelectOpen}
                      onOpenChange={setLocationSelectOpen}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select printer / slot…" />
                      </SelectTrigger>
                      <SelectContent>
                        {namingTarget.locations.map((loc, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {loc.printerName} {formatSlotLabel(loc)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {namingTarget.editableType && (
                  <div className="space-y-1.5">
                    <Label>Filament type</Label>
                    <Input
                      value={namingTypeInput}
                      onChange={(e) => setNamingTypeInput(e.target.value)}
                      placeholder="e.g. PLA Matte"
                      autoFocus
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Colour name</Label>
                  <Input
                    value={namingNameInput}
                    onChange={(e) => setNamingNameInput(e.target.value)}
                    placeholder="e.g. Bambu Black"
                    disabled={namingLocationIdx < 0}
                    autoFocus={
                      namingLocationIdx >= 0 && !namingTarget.editableType
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hex colour</Label>
                  <div className="flex items-center gap-2">
                    <ColorSwatch hex={namingHexInput || "FFFFFF"} />
                    <Input
                      value={namingHexInput}
                      onChange={(e) => setNamingHexInput(e.target.value)}
                      placeholder="RRGGBB"
                      disabled={namingLocationIdx < 0}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNamingTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submitNamingPopup}
                  disabled={
                    namingLocationIdx < 0 ||
                    nameFilamentColorMutation.isPending ||
                    !namingNameInput.trim() ||
                    !namingHexInput.trim() ||
                    (namingTarget.editableType && !namingTypeInput.trim())
                  }
                >
                  {nameFilamentColorMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* "Can't find your filament?" manual lookup */}
      <Dialog
        open={findFilamentOpen}
        onOpenChange={(o) => {
          setFindFilamentOpen(o);
          if (!o) setFindPrinterId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Can't find your filament?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Printer</Label>
              <Select
                value={findPrinterId?.toString() ?? ""}
                onValueChange={(v) => setFindPrinterId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select printer…" />
                </SelectTrigger>
                <SelectContent>
                  {(printers ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {p.model ? ` (${p.model})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {findPrinterId != null && (
              <div className="space-y-1">
                <Label>Slot</Label>
                {findPrinterAmsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Loading slots…
                  </p>
                ) : (findPrinterAmsQuery.data?.slots ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No slots found on this printer.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {(findPrinterAmsQuery.data?.slots ?? []).map((s, i) => {
                      const printerName =
                        printers?.find((p) => p.id === findPrinterId)?.name ??
                        `#${findPrinterId}`;
                      const label =
                        s.amsId === 255
                          ? `External Spool ${s.trayId + 1}`
                          : `AMS${s.amsId} Tray${s.trayId}`;
                      return (
                        <button
                          key={i}
                          type="button"
                          className="w-full flex items-center gap-2.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent text-left min-w-0"
                          onClick={() => {
                            openFindFilamentPopup(
                              {
                                printerId: findPrinterId,
                                printerName,
                                amsId: s.amsId,
                                trayId: s.trayId,
                              },
                              s.trayType
                                ? {
                                    type: s.trayType,
                                    hex: s.trayColor ?? "",
                                    colorName: s.colorName,
                                  }
                                : null,
                            );
                            setFindFilamentOpen(false);
                          }}
                        >
                          {s.trayColor ? (
                            <ColorSwatch hex={s.trayColor} />
                          ) : (
                            <span className="w-4 h-4 rounded-sm border border-dashed border-border shrink-0" />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block truncate font-medium">
                              {label}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {s.trayType
                                ? `${s.colorName ?? "Unnamed"} - ${s.trayType}`
                                : "No filament registered"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
