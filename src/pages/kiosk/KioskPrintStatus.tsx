import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/client/trpc";
import { PrintRatingDialog } from "@/components/print/PrintRatingDialog";
import { useKiosk } from "@/contexts/kiosk-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Printer,
  ListOrdered,
  AlertCircle,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Loader2,
  HelpCircle,
  WifiOff,
  Zap,
  CheckSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/api/routers/_app";

type KioskPrinter =
  inferRouterOutputs<AppRouter>["print"]["getKioskPrinterStatuses"][number];
type KioskQueueItem =
  inferRouterOutputs<AppRouter>["printQueue"]["getKioskQueue"][number];

const REFETCH_INTERVAL_MS = 15_000;

function ColorSwatch({ hex }: { hex: string | null }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-sm border border-border/50 shrink-0"
      style={{ backgroundColor: hex ? `#${hex.slice(0, 6)}` : "transparent" }}
    />
  );
}

function StateIcon({ state }: { state: string }) {
  const s = state.toUpperCase();
  if (s === "PRINTING")
    return (
      <motion.span
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "inline-flex" }}
      >
        <Play className="w-4 h-4 text-yellow-500" aria-label="Printing" />
      </motion.span>
    );
  if (s === "PAUSED")
    return <Pause className="w-4 h-4 text-yellow-500" aria-label="Paused" />;
  if (s === "BUSY")
    return (
      <Loader2
        className="w-4 h-4 text-yellow-500 animate-spin"
        aria-label="Busy"
      />
    );
  if (s === "FINISHED")
    return (
      <CheckCircle2 className="w-4 h-4 text-blue-500" aria-label="Finished" />
    );
  if (s === "IDLE" || s === "READY")
    return (
      <CheckCircle2 className="w-4 h-4 text-green-500" aria-label="Ready" />
    );
  if (s === "ATTENTION")
    return (
      <motion.span
        animate={{ rotate: [-4, 4, -4] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "inline-flex" }}
      >
        <Zap className="w-4 h-4 text-red-500" aria-label="Needs attention" />
      </motion.span>
    );
  if (s === "UNREACHABLE")
    return (
      <WifiOff className="w-4 h-4 text-red-500" aria-label="Unreachable" />
    );
  if (s === "CONNECTING")
    return (
      <Loader2
        className="w-4 h-4 text-muted-foreground animate-spin"
        aria-label="Connecting"
      />
    );
  if (s === "UNKNOWN")
    return (
      <HelpCircle
        className="w-4 h-4 text-muted-foreground"
        aria-label="Unknown"
      />
    );
  return (
    <XCircle className="w-4 h-4 text-muted-foreground" aria-label={state} />
  );
}

function statusBadge(
  state: string,
): "default" | "secondary" | "destructive" | "outline" {
  const s = state.toUpperCase();
  if (["PRINTING", "PAUSED", "BUSY"].includes(s)) return "secondary";
  if (["ATTENTION", "UNREACHABLE"].includes(s)) return "destructive";
  if (["IDLE", "READY", "FINISHED"].includes(s)) return "default";
  return "outline";
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function queueStatusBadge(
  status: string,
  hasError: boolean,
): "default" | "secondary" | "destructive" | "outline" {
  if (hasError) return "destructive";
  if (status === "printing") return "secondary";
  return "outline";
}

function QueueRow({ item, idx }: { item: KioskQueueItem; idx: number }) {
  const hasError =
    item.status === "pending" &&
    item.printerHmsErrors != null &&
    item.printerHmsErrors.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, height: 0 }}
      transition={{ duration: 0.25, delay: idx * 0.05 }}
      className={`px-4 py-3 space-y-1.5 ${idx !== 0 ? "border-t" : ""}`}
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-muted-foreground w-5 shrink-0 text-center">
          {item.position ?? idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {item.file_name ?? "Unnamed file"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.printer_name && (
              <p className="text-xs text-muted-foreground truncate">
                {item.printer_name}
              </p>
            )}
            {item.printer_name && item.submitted_by && (
              <span className="text-xs text-muted-foreground">·</span>
            )}
            {item.submitted_by && (
              <p className="text-xs text-muted-foreground truncate">
                {item.submitted_by}
              </p>
            )}
            {item.submitted_by && item.project && (
              <span className="text-xs text-muted-foreground">·</span>
            )}
            {item.project && (
              <p className="text-xs text-muted-foreground truncate">
                {item.project}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant={queueStatusBadge(item.status ?? "", hasError)}
          className="shrink-0 capitalize text-xs"
        >
          {hasError ? "Error" : item.status}
        </Badge>
      </div>

      {/* Printer AMS/HMS errors — same as the print queue page: a pending
          job never waits on a human, so if it's stuck its printer has a
          real problem. */}
      {hasError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 space-y-1 ml-9">
          {item.printerHmsErrors!.map((e) => (
            <p key={e.code} className="text-xs text-destructive leading-snug">
              {e.description}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function PrinterCard({
  printer,
  index,
}: {
  printer: KioskPrinter;
  index: number;
}) {
  const utils = trpc.useUtils();
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);

  const isAttention = printer.state.toUpperCase() === "ATTENTION";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      <Card>
        <CardContent className="pt-5 pb-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StateIcon state={printer.state} />
              <div className="min-w-0">
                <p className="font-medium truncate leading-tight">
                  {printer.printerName}
                </p>
                {printer.printerModel && (
                  <p className="text-xs text-muted-foreground">
                    {printer.printerModel}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={statusBadge(printer.state)}
              className="shrink-0 capitalize text-xs"
            >
              {printer.stateMessage.split(" (")[0]}
            </Badge>
          </div>

          {/* Progress bar */}
          {printer.progress != null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[60%]">
                  {printer.fileName ?? "Printing…"}
                </span>
                <span>{Math.round(printer.progress)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(printer.progress)}%` }}
                  transition={{ type: "spring", stiffness: 60, damping: 18 }}
                />
              </div>
              {printer.timeRemaining != null && (
                <p className="text-xs text-muted-foreground text-right">
                  {formatMinutes(printer.timeRemaining)} remaining
                </p>
              )}
            </div>
          )}

          {/* Filename when no progress */}
          {printer.progress == null && printer.fileName && (
            <p className="text-xs text-muted-foreground truncate">
              {printer.fileName}
            </p>
          )}

          {/* HMS errors */}
          {isAttention && printer.hmsErrors.length > 0 && (
            <motion.div
              className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 space-y-1"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25 }}
            >
              {printer.hmsErrors.map((e) => (
                <p
                  key={e.code}
                  className="text-xs text-destructive leading-snug"
                >
                  {e.description}
                </p>
              ))}
            </motion.div>
          )}

          {/* AMS filament — same type + colour name (or Unknown) logic as
              Printer Monitoring and the print queue's filament picker */}
          {printer.amsSlots.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {printer.amsSlots.map((slot) => (
                <span
                  key={`${slot.amsId}:${slot.trayId}`}
                  className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px]"
                >
                  <ColorSwatch hex={slot.colorHex} />
                  <span className="font-medium">{slot.type}</span>
                  <span
                    className={
                      slot.colorName
                        ? "text-muted-foreground"
                        : "text-amber-600 dark:text-amber-400 font-medium"
                    }
                  >
                    {slot.colorName ?? "Unknown"}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Clear build plate */}
          {printer.awaitingPlateClear && printer.bambuddyId != null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              whileTap={{ scale: 0.97 }}
            >
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setRatingDialogOpen(true)}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Confirm Build Plate Cleared
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {printer.bambuddyId != null && (
        <PrintRatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          bambuddyId={printer.bambuddyId}
          printerName={printer.printerName}
          fileName={printer.fileName ?? undefined}
          mode="kiosk"
          onCleared={() => {
            toast.success("Build plate cleared", {
              description: "Next job in queue will start automatically.",
            });
            void utils.print.getKioskPrinterStatuses.invalidate();
            void utils.printQueue.getKioskQueue.invalidate();
          }}
        />
      )}
    </motion.div>
  );
}

export default function KioskPrintStatus() {
  const { session } = useKiosk();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) void navigate("/kiosk", { replace: true });
  }, [session, navigate]);

  const printersQuery = trpc.print.getKioskPrinterStatuses.useQuery(undefined, {
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const queueQuery = trpc.printQueue.getKioskQueue.useQuery(undefined, {
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const [showHistory, setShowHistory] = useState(false);

  if (!session) return null;

  const activeItems = (queueQuery.data ?? []).filter(
    (i) => i.status === "pending" || i.status === "printing",
  );
  const historyItems = [...(queueQuery.data ?? [])]
    .filter((i) => i.status !== "pending" && i.status !== "printing")
    .sort((a, b) =>
      (b.completed_at ?? b.created_at ?? "").localeCompare(
        a.completed_at ?? a.created_at ?? "",
      ),
    );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <motion.div
        className="border-b px-6 py-4 flex items-center gap-4"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate("/kiosk/home")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-xl font-semibold">Printer Status</h1>
      </motion.div>

      <div className="flex-1 p-6 space-y-8 overflow-auto">
        {/* Printers */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Printer className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Printers</h2>
          </div>

          {printersQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : printersQuery.isError ? (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              Could not load printer status.
            </div>
          ) : !printersQuery.data?.length ? (
            <p className="text-sm text-muted-foreground">
              No printers configured.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {printersQuery.data.map((printer, i) => (
                <PrinterCard
                  key={printer.printerId}
                  printer={printer}
                  index={i}
                />
              ))}
            </div>
          )}
        </motion.section>

        {/* Queue */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <ListOrdered className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Print Queue</h2>
          </div>

          {queueQuery.isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : queueQuery.isError ? (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              Could not load queue.
            </div>
          ) : !queueQuery.data?.length ? (
            <p className="text-sm text-muted-foreground">
              Queue is empty - no pending or active jobs.
            </p>
          ) : (
            <div className="space-y-2">
              {activeItems.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No active jobs.
                </p>
              )}
              {activeItems.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <AnimatePresence initial={false}>
                    {activeItems.map((item, idx) => (
                      <QueueRow key={item.id} item={item} idx={idx} />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {historyItems.length > 0 && (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground py-2"
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    {showHistory ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {showHistory ? "Hide" : "Show"} {historyItems.length}{" "}
                    finished job
                    {historyItems.length === 1 ? "" : "s"}
                  </button>
                  {showHistory && (
                    <div className="rounded-lg border overflow-hidden">
                      <AnimatePresence initial={false}>
                        {historyItems.map((item, idx) => (
                          <QueueRow key={item.id} item={item} idx={idx} />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </motion.section>
      </div>

      <div className="border-t px-6 py-3 text-center text-xs text-muted-foreground">
        Refreshes every 15 seconds
      </div>
    </div>
  );
}
