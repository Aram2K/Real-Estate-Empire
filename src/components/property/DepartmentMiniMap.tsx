"use client";

import { IDF_DEPARTMENTS } from "@/lib/constants";

const SHAPES: Record<string, string> = {
  "95": "54,4 116,4 128,31 104,51 66,45 43,24",
  "78": "5,31 43,24 66,45 57,76 32,101 5,82",
  "92": "57,47 75,45 81,61 70,79 56,75",
  "75": "78,54 91,54 96,66 86,75 73,68",
  "93": "91,35 124,32 137,57 111,76 96,66 91,54",
  "94": "86,75 96,66 111,76 124,103 94,116 69,94 70,79",
  "91": "32,101 57,76 70,79 69,94 94,116 76,143 35,137 18,116",
  "77": "124,32 166,23 188,54 181,111 145,145 76,143 94,116 124,103 111,76 137,57",
};

const LABELS: Record<string, [number, number]> = {
  "95": [82, 25], "78": [29, 64], "92": [66, 63], "75": [85, 65],
  "93": [113, 55], "94": [98, 91], "91": [55, 116], "77": [151, 87],
};

export function DepartmentMiniMap({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">Departments · click the map</div>
      <svg viewBox="0 0 193 149" className="h-32 w-44" role="group" aria-label="Select Île-de-France departments">
        {IDF_DEPARTMENTS.map((department) => {
          const active = selected.includes(department.code);
          const [x, y] = LABELS[department.code];
          return (
            <g key={department.code} role="button" tabIndex={0} aria-label={`${department.name} (${department.code})`} aria-pressed={active}
              className="cursor-pointer outline-none" onClick={() => onToggle(department.code)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(department.code); } }}>
              <polygon points={SHAPES[department.code]} className={`stroke-white stroke-[2] transition-colors ${active ? "fill-blue-700" : "fill-slate-200 hover:fill-blue-200"}`} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className={`pointer-events-none select-none text-[10px] font-bold ${active ? "fill-white" : "fill-slate-700"}`}>{department.code}</text>
              <title>{department.name}</title>
            </g>
          );
        })}
      </svg>
      <div className="max-w-52 text-[11px] text-slate-500">{selected.length ? selected.map((code) => IDF_DEPARTMENTS.find((d) => d.code === code)?.name).join(", ") : "All departments"}</div>
    </div>
  );
}
