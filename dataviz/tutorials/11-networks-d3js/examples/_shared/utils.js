// =============================================================================
// utils.js — shared helpers for the L11 standalone examples.
//
// One-stop file: every example references it via
//     <script src="../_shared/utils.js"></script>
// and gets makeCanvas, boundaryForce, fitToCanvas, attachWarmup in scope.
// These are copies of the helpers in 11-networks-d3js/_shared/chart.js, so the
// examples behave identically to the embedded demos in the tutorial pages.
// =============================================================================

const CANVAS = {
    width: 800,
    margin: { top: 24, right: 30, bottom: 36, left: 50 }
};

// idOf — a link's source/target carries a string id before d3.forceLink runs,
// a node object after. Reading `.id ?? ref` unifies both cases so the same
// code works regardless of when it runs.
const idOf = ref => ref.id ?? ref;

// buildNeighbors — returns Map<id, Set<id>> where each node id maps to a set
// containing itself plus every neighbour's id. O(1) lookup per hover event.
// (The neighbour-map technique is introduced in 11c §2; this is the same
// construction packaged for reuse.)
function buildNeighbors(nodes, links) {
    const m = new Map(nodes.map(n => [n.id, new Set([n.id])]));
    for (const l of links) {
        const a = idOf(l.source), b = idOf(l.target);
        m.get(a).add(b); m.get(b).add(a);
    }
    return m;
}

// makeCanvas — append an <svg> with the standard margin convention.
// Every demo in L11 uses a fixed 800-px coordinate space so the layouts have
// the same scale across examples; CSS still scales the rendered SVG to fit
// the container via `width: 100%; height: auto;`.
//
// SVG structure:
//   <svg>
//     <g class="margin">          ← fixed margin offset; not zoomed
//       <rect class="plot-bg"/>   ← optional plot-area background
//       <g class="plot">          ← THE pan/zoom target; every mark goes here
//         (marks)
//       </g>
//     </g>
//   </svg>
//
// Every demo gets pan + zoom for free: drag the empty background to pan,
// wheel/pinch to zoom. Pass opts.pan = false to disable. Demos that need a
// custom zoom (e.g. zoom-invariant sizing) just call root.call(theirZoom)
// after makeCanvas returns — that replaces the default.
function makeCanvas(selector, height, opts = {}) {
    const m = { ...CANVAS.margin, ...(opts.margin || {}) };
    const w = opts.width ?? CANVAS.width;
    const innerW = w - m.left - m.right;
    const innerH = height - m.top - m.bottom;

    const root = d3.select(selector).append("svg")
        .attr("width", w).attr("height", height)
        .attr("viewBox", `0 0 ${w} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("background", "#fafafa").style("border", "1px solid #ddd")
        .style("display", "block").style("cursor", "grab")
        .style("touch-action", "none");

    const marginG = root.append("g")
        .attr("transform", `translate(${m.left}, ${m.top})`);
    if (opts.showPlotArea) {
        marginG.append("rect")
            .attr("width", innerW).attr("height", innerH)
            .attr("fill", "#f8f9fa").attr("stroke", "#dee2e6");
    }
    const plot = marginG.append("g");

    if (opts.pan !== false) {
        const zoom = d3.zoom()
            .scaleExtent([0.3, 4])
            .on("zoom", (e) => plot.attr("transform", e.transform))
            .on("start", () => root.style("cursor", "grabbing"))
            .on("end",   () => root.style("cursor", "grab"));
        root.call(zoom);
        root.on("dblclick.zoom", null);   // avoid surprise zoom on double-click
    }

    return { root, plot, marginG, innerW, innerH, margin: m, width: w, height };
}

// boundaryForce — keeps every node inside the inner-canvas rectangle by
// clamping its (x, y) on every tick. Pass the inner dimensions; the
// d.__r property (when set) is used as a per-node padding radius.
function boundaryForce(innerW, innerH, pad = 4) {
    let nodes;
    function force() {
        for (const d of nodes) {
            const r = (d.__r ?? pad);
            d.x = Math.max(r, Math.min(innerW - r, d.x));
            d.y = Math.max(r, Math.min(innerH - r, d.y));
        }
    }
    force.initialize = _ => { nodes = _; };
    return force;
}

// fitToCanvas — on the simulation's "end" event, computes the bounding
// box of the node positions and transforms a wrapping <g> so the graph
// fills the canvas. Re-fits on every reheat → end cycle.
function fitToCanvas(wrap, sim, nodes, innerW, innerH, opts = {}) {
    const padding = opts.padding ?? 20;
    const dur = opts.duration ?? 400;
    function fit() {
        if (!nodes.length) return;
        const xs = nodes.map(d => d.x), ys = nodes.map(d => d.y);
        const x0 = d3.min(xs), x1 = d3.max(xs);
        const y0 = d3.min(ys), y1 = d3.max(ys);
        const dx = (x1 - x0) || 1;
        const dy = (y1 - y0) || 1;
        const k = Math.min(
            (innerW - 2 * padding) / dx,
            (innerH - 2 * padding) / dy
        );
        const tx = padding + (innerW - 2 * padding - k * dx) / 2 - k * x0;
        const ty = padding + (innerH - 2 * padding - k * dy) / 2 - k * y0;
        wrap.transition().duration(dur)
            .attr("transform", `translate(${tx}, ${ty}) scale(${k})`);
    }
    sim.on("end.fit", fit);
    return fit;
}

// attachWarmup — translucent "warming up…" overlay over the SVG. Removed as
// soon as the simulation's alpha drops below 0.1 (~1.7s at default decay),
// rather than waiting all the way to the "end" event (~5s). By then the
// layout is visually settled even if the simulation is still ticking down.
function attachWarmup(svgRoot, sim, label = "warming up the layout…") {
    const w = +svgRoot.attr("width");
    const h = +svgRoot.attr("height");
    const overlay = svgRoot.append("g").attr("class", "warmup-overlay");
    overlay.append("rect")
        .attr("width", w).attr("height", h)
        .attr("fill", "white").attr("opacity", 0.7);
    overlay.append("text")
        .attr("x", w / 2).attr("y", h / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#555")
        .text(label);

    const HIDE_AT = 0.1;
    function hide() {
        overlay.transition().duration(200).style("opacity", 0).remove();
        sim.on("tick.warmup", null);
        sim.on("end.warmup",  null);
    }
    sim.on("tick.warmup", () => { if (sim.alpha() <= HIDE_AT) hide(); });
    sim.on("end.warmup",  hide);
    return overlay;
}
