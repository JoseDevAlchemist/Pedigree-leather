export function SoldOutOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-1 grid place-items-center rounded-[inherit] bg-neutral-900/25 backdrop-grayscale">
      <span className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold tracking-wide text-white">
        SOLD OUT
      </span>
    </div>
  );
}
