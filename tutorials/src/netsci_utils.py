"""
netsci_utils.py — Shared utilities for the Network Science course tutorials.

Usage:
    from netsci_utils import *          # import everything
    from netsci_utils import draw_graph  # selective import

Students: feel free to read this file — it contains the helper functions
used throughout the tutorials so you don't have to copy-paste them.
"""

import os
import random
import pathlib

import numpy as np
import matplotlib.pyplot as plt
import networkx as nx

# ---------------------------------------------------------------------------
# Constants — course-wide visual defaults
# ---------------------------------------------------------------------------

RANDOM_SEED       = 42
FIGURE_SIZE       = (10, 6)
FIGURE_SIZE_SMALL = (6, 4)
NODE_COLOR        = '#4C72B0'   # muted blue
EDGE_COLOR        = '#888888'
NODE_SIZE         = 500
FONT_SIZE         = 10
CMAP              = 'viridis'   # for metric-based node colouring

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------

def set_seeds(seed: int = RANDOM_SEED) -> None:
    """Set Python ``random`` and NumPy seeds for reproducible results."""
    random.seed(seed)
    np.random.seed(seed)


# ---------------------------------------------------------------------------
# Matplotlib setup
# ---------------------------------------------------------------------------

def setup_matplotlib() -> None:
    """Apply course-wide rcParams: figure size, font, grid, tight layout."""
    plt.rcParams.update({
        'figure.figsize':     FIGURE_SIZE,
        'font.size':          FONT_SIZE,
        'axes.grid':          True,
        'grid.alpha':         0.3,
        'figure.autolayout':  True,
    })


# Call at import time unless the user opts out via env variable.
if os.environ.get('NETSCI_SETUP', '1') != '0':
    setup_matplotlib()


# ---------------------------------------------------------------------------
# Graph drawing
# ---------------------------------------------------------------------------

def draw_graph(
    G,
    pos=None,
    ax=None,
    node_color=NODE_COLOR,
    node_size=NODE_SIZE,
    edge_color=EDGE_COLOR,
    font_size=FONT_SIZE,
    with_labels=True,
    seed=RANDOM_SEED,
    **kwargs,
):
    """Draw *G* with course-standard visual defaults.

    Parameters
    ----------
    G : nx.Graph
        The graph to draw.
    pos : dict, optional
        Node positions.  If *None*, ``spring_layout`` is used.
    ax : matplotlib.axes.Axes, optional
        Target axes.  If *None*, uses the current axes.
    seed : int
        Seed for ``spring_layout`` when *pos* is *None*.
    **kwargs
        Additional keyword arguments forwarded to ``nx.draw``.
    """
    if pos is None:
        pos = nx.spring_layout(G, seed=seed)
    nx.draw(
        G,
        pos=pos,
        ax=ax,
        node_color=node_color,
        node_size=node_size,
        edge_color=edge_color,
        font_size=font_size,
        with_labels=with_labels,
        **kwargs,
    )
    return pos


def draw_graph_metric(
    G,
    metric_dict,
    pos=None,
    ax=None,
    cmap=CMAP,
    edge_color=EDGE_COLOR,
    font_size=FONT_SIZE,
    with_labels=True,
    min_node_size=100,
    max_node_size=2000,
    seed=RANDOM_SEED,
    colorbar=True,
    **kwargs,
):
    """Draw *G* with nodes sized and coloured by *metric_dict*.

    Parameters
    ----------
    G : nx.Graph
    metric_dict : dict
        Mapping ``{node: value}`` used for both colour and size.
    pos : dict, optional
    ax : matplotlib.axes.Axes, optional
    cmap : str
        Matplotlib colourmap name.
    min_node_size, max_node_size : float
        Node sizes are linearly scaled to this range.
    colorbar : bool
        Whether to add a colour bar to *ax* (requires *ax* to be provided
        or the current axes).
    **kwargs
        Forwarded to ``nx.draw``.

    Returns
    -------
    pos : dict
    """
    if pos is None:
        pos = nx.spring_layout(G, seed=seed)

    values = np.array([metric_dict.get(n, 0) for n in G.nodes()])
    v_min, v_max = values.min(), values.max()
    if v_max > v_min:
        sizes = min_node_size + (max_node_size - min_node_size) * (
            (values - v_min) / (v_max - v_min)
        )
    else:
        sizes = np.full(len(values), (min_node_size + max_node_size) / 2)

    target_ax = ax if ax is not None else plt.gca()
    sc = nx.draw(
        G,
        pos=pos,
        ax=target_ax,
        node_color=values,
        node_size=sizes,
        edge_color=edge_color,
        font_size=font_size,
        with_labels=with_labels,
        cmap=plt.get_cmap(cmap),
        vmin=v_min,
        vmax=v_max,
        **kwargs,
    )
    if colorbar:
        sm = plt.cm.ScalarMappable(
            cmap=plt.get_cmap(cmap),
            norm=plt.Normalize(vmin=v_min, vmax=v_max),
        )
        sm.set_array([])
        fig = target_ax.get_figure() if target_ax else plt.gcf()
        fig.colorbar(sm, ax=target_ax)
    return pos


# ---------------------------------------------------------------------------
# Degree distributions / CCDF
# ---------------------------------------------------------------------------

def compute_ccdf(sequence):
    """Compute the Complementary Cumulative Distribution Function (CCDF).

    Parameters
    ----------
    sequence : array-like
        Sequence of values (e.g. node degrees).

    Returns
    -------
    x : np.ndarray
        Sorted unique values.
    y : np.ndarray
        P(X >= x) for each value in *x*.
    """
    values = np.asarray(sequence)
    unique, counts = np.unique(values, return_counts=True)
    probs = counts / counts.sum()
    # P(X >= x) = 1 - CDF(x-1) = reverse cumsum shifted by one
    ccdf = np.cumsum(probs[::-1])[::-1]
    return unique, ccdf


def plot_ccdf(
    sequence,
    ax=None,
    label=None,
    color=None,
    marker='o',
    markersize=3,
    linestyle='None',
    loglog=True,
    xlabel='Value',
    ylabel='P(X ≥ x)',
    **kwargs,
):
    """Plot the CCDF of *sequence* on log-log axes.

    Parameters
    ----------
    sequence : array-like
    ax : matplotlib.axes.Axes, optional
        If *None*, uses the current axes.
    label : str, optional
        Legend label.
    loglog : bool
        Whether to use log-log scale (default *True*).
    **kwargs
        Forwarded to ``ax.plot``.

    Returns
    -------
    ax : matplotlib.axes.Axes
    """
    if ax is None:
        ax = plt.gca()
    x, y = compute_ccdf(sequence)
    ax.plot(x, y, marker=marker, markersize=markersize,
            linestyle=linestyle, label=label, color=color, **kwargs)
    if loglog:
        ax.set_xscale('log')
        ax.set_yscale('log')
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(True, which='both', ls='--', alpha=0.3)
    return ax


# ---------------------------------------------------------------------------
# Network statistics
# ---------------------------------------------------------------------------

def network_stats(G):
    """Return a dict of common network statistics for *G*.

    Keys: ``n_nodes``, ``n_edges``, ``density``, ``avg_degree``,
    ``avg_clustering``, ``diameter`` (or ``None`` if disconnected).
    """
    n = G.number_of_nodes()
    L = G.number_of_edges()
    density = nx.density(G)
    avg_deg = (2 * L / n) if n > 0 else 0.0
    avg_clust = nx.average_clustering(G)
    try:
        diameter = nx.diameter(G)
    except nx.NetworkXError:
        diameter = None
    return {
        'n_nodes':       n,
        'n_edges':       L,
        'density':       density,
        'avg_degree':    avg_deg,
        'avg_clustering': avg_clust,
        'diameter':      diameter,
    }


def print_network_stats(G) -> None:
    """Print a short summary of key network statistics for *G*."""
    stats = network_stats(G)
    print(f"Nodes          : {stats['n_nodes']}")
    print(f"Edges          : {stats['n_edges']}")
    print(f"Density        : {stats['density']:.6f}")
    print(f"Average degree : {stats['avg_degree']:.4f}")
    print(f"Avg clustering : {stats['avg_clustering']:.4f}")
    if stats['diameter'] is not None:
        print(f"Diameter       : {stats['diameter']}")
    else:
        print("Diameter       : N/A (graph is disconnected)")


# ---------------------------------------------------------------------------
# Dataset loaders
# ---------------------------------------------------------------------------

_HERE = pathlib.Path(__file__).parent   # tutorials/src/
_DATASETS = _HERE / '..' / 'datasets'   # tutorials/datasets/


def load_openflights_usa() -> nx.Graph:
    """Load the US OpenFlights airport network.

    Returns
    -------
    nx.Graph
        Nodes are IATA codes with ``name``, ``latitude``, ``longitude``
        attributes.  Edges represent direct flight routes.
    """
    path = (_DATASETS / 'openflights' / 'openflights_usa.graphml.gz').resolve()
    return nx.read_graphml(str(path))


def load_openflights_world() -> nx.Graph:
    """Load the world OpenFlights airport network.

    Returns
    -------
    nx.Graph
    """
    path = (_DATASETS / 'openflights' / 'openflights_world.graphml.gz').resolve()
    return nx.read_graphml(str(path))


def load_friends() -> nx.Graph:
    """Load the ``friends.adjlist`` social graph.

    Returns
    -------
    nx.Graph
    """
    path = (_DATASETS / 'friends.adjlist').resolve()
    return nx.read_adjlist(str(path))
