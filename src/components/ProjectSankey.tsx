"use client";

import { useMemo, useState } from "react";
import { sankey, sankeyJustify } from "d3-sankey";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatCentsCompact } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Server-prepared data shape                                                  */
/* -------------------------------------------------------------------------- */

export type SankeyDataNode = {
  /** Globally unique id: prefixed by column ("L_" payer, "T_" txn, "R_" consumer). */
  id: string;
  /** Display label. */
  name: string;
  /** Column the node belongs to. Drives label + colour decisions. */
  type: "payer" | "txn" | "consumer";
  /** Hex fill from the avatar palette (or accent for txn nodes). */
  colorHex: string;
};

export type SankeyDataLink = {
  source: string;
  target: string;
  /** Flow magnitude in integer cents (positive). */
  value: number;
};

export type SankeyData = {
  nodes: SankeyDataNode[];
  links: SankeyDataLink[];
};

/* -------------------------------------------------------------------------- */
/* Post-layout types (d3-sankey augments each node/link with geometry)         */
/* -------------------------------------------------------------------------- */

type LaidOutNode = SankeyDataNode & {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  value: number;
  index: number;
  depth: number;
  height: number;
  layer: number;
  sourceLinks: LaidOutLink[];
  targetLinks: LaidOutLink[];
};

type LaidOutLink = SankeyDataLink & {
  width: number;
  y0: number;
  y1: number;
  source: LaidOutNode | string | number;
  target: LaidOutNode | string | number;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const VIEW_W = 1000;
const VIEW_H = 360;
const NODE_W = 14;
const NODE_PAD = 12;

/* -------------------------------------------------------------------------- */
/* Standard Sankey link path (centerline bezier, stroked with link.width).     */
/* Matches d3-shape's linkHorizontal shape but stays dependency-free.          */
/* -------------------------------------------------------------------------- */
function sankeyPath(
  source: LaidOutNode,
  target: LaidOutNode,
): string {
  const sx = source.x1;
  const sy = (source.y0 + source.y1) / 2;
  const tx = target.x0;
  const ty = (target.y0 + target.y1) / 2;
  const mx = (sx + tx) / 2;
  return `M ${sx},${sy} C ${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

/* -------------------------------------------------------------------------- */
/* Hover-state type                                                            */
/* -------------------------------------------------------------------------- */

type Hover =
  | { kind: "node"; node: LaidOutNode; clientX: number; clientY: number }
  | { kind: "link"; link: LaidOutLink; clientX: number; clientY: number };

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ProjectSankey({
  data,
  currencySymbol,
}: {
  data: SankeyData;
  currencySymbol: string;
}) {
  const layout = useMemo(() => {
    if (data.nodes.length === 0 || data.links.length === 0) return null;
    const gen = sankey<SankeyDataNode, SankeyDataLink>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(NODE_W)
      .nodePadding(NODE_PAD)
      .extent([
        [0, 8],
        [VIEW_W, VIEW_H - 8],
      ]);
    const result = gen({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    });
    return {
      nodes: result.nodes as unknown as LaidOutNode[],
      links: result.links as unknown as LaidOutLink[],
    };
  }, [data]);

  const [hover, setHover] = useState<Hover | null>(null);

  if (!layout || layout.links.length === 0) return null;
  const { nodes, links } = layout;

  // Label placement: left column → label to the right of the rect.
  // Right column → label to the left of the rect.
  // Middle column (transactions) → label to the right (closer to consumers)
  // since it has no overlap with payer-column labels which sit at x ≈ NODE_W.
  const labelX = (n: LaidOutNode) =>
    n.x0 < VIEW_W / 3 ? n.x1 + 6 : n.x0 - 6;
  const labelAnchor = (n: LaidOutNode) =>
    n.x0 < VIEW_W / 3 ? "start" : "end";

  // Truncate long titles — transaction titles can be long, person names usually short.
  const truncLabel = (s: string, max: number): string =>
    s.length > max ? `${s.slice(0, max - 1)}\u2026` : s;

  return (
    <Card className="lg:col-span-3 overflow-hidden">
      <CardHeader>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Money flow
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Payers (left) \u2192 transactions (middle) \u2192 consumers (right)
          </p>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {nodes.length} nodes \u00b7 {links.length} flows
        </span>
      </CardHeader>
      <CardBody className="h-[300px] px-2 pt-2 pb-3 sm:h-[380px]">
        <div className="relative h-full w-full">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-full w-full select-none"
            role="img"
            aria-label="Sankey diagram of payer to consumer money flow"
            onMouseLeave={() => setHover(null)}
          >
            {/* Links rendered first so the rects paint over their endpoints. */}
            {links.map((link, i) => {
              const src = link.source as LaidOutNode;
              const tgt = link.target as LaidOutNode;
              const path = sankeyPath(src, tgt);
              const sw = Math.max(1, link.width);
              // Color attribution: payer → txn links carry the per-payer color
              // (so you can trace who paid). txn → consumer links render in a
              // muted neutral — this also avoids leaking the synthesized
              // "T_other" bucket's colorHex (set by the first-paying payer at
              // ensureNode time) onto every outbound consumer flow, which
              // would misattribute all "Other transactions" consumption.
              const stroke =
                src.type === "payer" ? src.colorHex : "rgb(var(--muted))";
              return (
                <path
                  key={`l-${src.id}-${tgt.id}-${i}`}
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeOpacity={0.35}
                  className="cursor-pointer transition-[stroke-opacity] duration-150 hover:stroke-opacity-70"
                  onMouseMove={(e) =>
                    setHover({
                      kind: "link",
                      link,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    })
                  }
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const fill =
                node.type === "txn"
                  ? "rgb(var(--muted))"
                  : node.colorHex || "rgb(var(--accent))";
              const w = Math.max(0, node.x1 - node.x0);
              const h = Math.max(1, node.y1 - node.y0);
              const labelMax =
                node.type === "txn" ? (w >= 12 ? 14 : 8) : 22;
              return (
                <g key={node.id}>
                  <rect
                    x={node.x0}
                    y={node.y0}
                    width={w}
                    height={h}
                    fill={fill}
                    rx={2}
                    className="cursor-pointer"
                    onMouseMove={(e) =>
                      setHover({
                        kind: "node",
                        node,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      })
                    }
                  />
                  <text
                    x={labelX(node)}
                    y={(node.y0 + node.y1) / 2}
                    dy="0.35em"
                    textAnchor={labelAnchor(node)}
                    className="pointer-events-none fill-gray-700 text-[11px] font-medium dark:fill-gray-300"
                  >
                    {truncLabel(node.name, labelMax)}
                  </text>
                </g>
              );
            })}
          </svg>

          {hover && <FlowTooltip hover={hover} currencySymbol={currencySymbol} />}
        </div>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Floating tooltip                                                            */
/* -------------------------------------------------------------------------- */

function FlowTooltip({
  hover,
  currencySymbol,
}: {
  hover: Hover;
  currencySymbol: string;
}) {
  // The tooltip is `position: fixed` so the cursor-following math uses
  // viewport coordinates. window.innerWidth is only ever read here when
  // `hover` is non-null, which only happens after a client-side
  // `onMouseMove` fired \u2014 but we still guard against SSR / hydration
  // edge cases.
  const viewportW =
    typeof window !== "undefined" ? window.innerWidth : VIEW_W;
  const left = Math.max(8, Math.min(viewportW - 280, hover.clientX - 260));
  const top = Math.max(8, hover.clientY - 60);

  return (
    <div
      className="pointer-events-none fixed z-20 max-w-[260px] whitespace-pre-line rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
      style={{ left, top }}
    >
      {hover.kind === "node" ? (
        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {hover.node.type === "payer"
              ? "Payer"
              : hover.node.type === "txn"
                ? "Transaction"
                : "Consumer"}
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {hover.node.name}
          </div>
          <div className="mt-1 text-gray-700 dark:text-gray-300">
            Total:{" "}
            <span className="font-mono font-semibold text-gray-900 dark:text-white">
              {formatCentsCompact(hover.node.value ?? 0, currencySymbol)}
            </span>
          </div>
        </div>
      ) : (
        <div>
          {(() => {
            const src = hover.link.source as LaidOutNode;
            const tgt = hover.link.target as LaidOutNode;
            return (
              <>
                <div className="mb-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Flow
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {src.name} \u2192 {tgt.name}
                </div>
                <div className="mt-1 text-gray-700 dark:text-gray-300">
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">
                    {formatCentsCompact(hover.link.value, currencySymbol)}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
