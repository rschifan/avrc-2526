// =============================================================================
// utils.js — shared helpers for the L12 standalone examples.
//
// One-stop file: every example references it via
//     <script src="../_shared/utils.js"></script>
// and gets makeCanvas, boundaryForce, fitToCanvas, attachWarmup in scope, so the
// examples behave identically to the embedded demos in the tutorial pages.
// =============================================================================

const CANVAS = {
    fallbackWidth: 800,
    margin: { top: 24, right: 30, bottom: 36, left: 50 }
};

// makeCanvas — append an <svg> with the standard margin convention.
// Returns { root, plot, innerW, innerH, margin, width, height }:
//   root   = the <svg> selection
//   plot   = the inner <g> shifted by the margins (every mark goes here)
function makeCanvas(selector, height, opts = {}) {
    const m = { ...CANVAS.margin, ...(opts.margin || {}) };
    let measured = null;
    const containerEl = (typeof selector === "string")
        ? document.querySelector(selector) : null;
    if (containerEl) {
        measured = Math.floor(containerEl.getBoundingClientRect().width);
        if (!measured) measured = null;
    }
    const w = opts.width ?? measured ?? CANVAS.fallbackWidth;
    const innerW = w - m.left - m.right;
    const innerH = height - m.top - m.bottom;
    const root = d3.select(selector).append("svg")
        .attr("width", w).attr("height", height)
        .attr("viewBox", `0 0 ${w} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("background", "#fafafa").style("border", "1px solid #ddd")
        .style("display", "block");
    const plot = root.append("g")
        .attr("transform", `translate(${m.left}, ${m.top})`);
    if (opts.showPlotArea) {
        plot.append("rect")
            .attr("width", innerW).attr("height", innerH)
            .attr("fill", "#f8f9fa").attr("stroke", "#dee2e6");
    }
    return { root, plot, innerW, innerH, margin: m, width: w, height };
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

// attachWarmup — translucent "warming up…" overlay tied to the simulation's
// lifecycle. Removed when the simulation fires "end".
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
    sim.on("end.warmup", () => overlay.transition().duration(250).style("opacity", 0).remove());
    return overlay;
}
