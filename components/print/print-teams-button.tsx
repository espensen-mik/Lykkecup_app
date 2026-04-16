"use client";

export function PrintTeamsButton() {
  return (
    <div className="print:hidden mb-8">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded border border-black bg-white px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-neutral-100"
      >
        Print
      </button>
    </div>
  );
}
