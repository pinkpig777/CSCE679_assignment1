/**
 * common.js
 * Shared building blocks for the Level 1 and Level 2 temperature heatmaps.
 * Each function has one responsibility so both levels can compose them.
 * Requires D3 v7 to be loaded globally as `d3`.
 */

/* ------------------------------------------------------------------ */
/* Shared configuration                                                */
/* ------------------------------------------------------------------ */

const SHARED_CONFIG = {
  dataFile: "temperature_daily.csv",
  monthNames: ["January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"],

  // Color encoding: quantized reversed Spectral (blue = cold, red = hot)
  colorDomain: [0, 40],            // °C
  colorBinCount: 11,
  legendUnitLabel: "Celsius",

  // Legend swatch geometry
  legendSwatchWidth: 18,
  legendSwatchHeight: 22,
  legendOffsetX: 20,               // gap between grid and legend
  legendLabelGap: 6,               // gap between swatch and its label

  // Cell spacing as a fraction of the band size
  cellPadding: 0.12,

  // Tooltip offset from the mouse pointer (px)
  tooltipOffsetX: 12,
  tooltipOffsetY: -28,

  // Duration of the color transition when toggling max/min (ms)
  transitionMs: 400,

  // Available temperature modes; keys match fields on each monthly record
  modes: { max: "Max temperature", min: "Min temperature" },
  defaultMode: "max"
};

/* ------------------------------------------------------------------ */
/* Data loading & aggregation                                          */
/* ------------------------------------------------------------------ */

/**
 * Load the daily CSV and convert each row into
 * { date: Date, max: number, min: number }.
 */
function loadDailyTemperatures(file = SHARED_CONFIG.dataFile) {
  const parseDate = d3.timeParse("%Y-%m-%d");
  return d3.csv(file, row => ({
    date: parseDate(row.date),
    max: +row.max_temperature,
    min: +row.min_temperature
  }));
}

/** Keep only the most recent `yearCount` years of daily records. */
function filterLastYears(dailyRecords, yearCount) {
  const lastYear = d3.max(dailyRecords, d => d.date.getFullYear());
  const firstYear = lastYear - yearCount + 1;
  return dailyRecords.filter(d => d.date.getFullYear() >= firstYear);
}

/**
 * Group daily records into one record per (year, month):
 *   { year, month (0-11), max: highest daily max, min: lowest daily min,
 *     days: the month's daily records sorted by date }
 */
function aggregateByMonth(dailyRecords) {
  return d3.flatRollup(
      dailyRecords,
      daysInMonth => {
        const days = daysInMonth.slice().sort((a, b) => a.date - b.date);
        return {
          max: d3.max(days, d => d.max),
          min: d3.min(days, d => d.min),
          days
        };
      },
      d => d.date.getFullYear(),
      d => d.date.getMonth())
    .map(([year, month, summary]) => ({ year, month, ...summary }));
}

/** List every year from the earliest to the latest in the monthly records. */
function getYearRange(monthlyRecords) {
  return d3.range(
    d3.min(monthlyRecords, d => d.year),
    d3.max(monthlyRecords, d => d.year) + 1);
}

/** Format a monthly record as "YYYY-MM". */
function formatYearMonth(record) {
  return `${record.year}-${String(record.month + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Chart scaffolding                                                   */
/* ------------------------------------------------------------------ */

/**
 * Size the SVG and return the inner <g> plus the inner width/height.
 * Grid size is derived from the number of years and months.
 */
function createChartArea(svgSelector, years, layout) {
  const innerWidth = years.length * layout.cellWidth;
  const innerHeight = SHARED_CONFIG.monthNames.length * layout.cellHeight;
  const { margin } = layout;

  const svg = d3.select(svgSelector)
    .attr("width", innerWidth + margin.left + margin.right)
    .attr("height", innerHeight + margin.top + margin.bottom);

  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return { svg, plot, innerWidth, innerHeight };
}

/** Band scales: x = year, y = month index. */
function createGridScales(years, innerWidth, innerHeight) {
  const monthIndices = d3.range(SHARED_CONFIG.monthNames.length);
  return {
    xScale: d3.scaleBand().domain(years).range([0, innerWidth])
      .padding(SHARED_CONFIG.cellPadding),
    yScale: d3.scaleBand().domain(monthIndices).range([0, innerHeight])
      .padding(SHARED_CONFIG.cellPadding)
  };
}

/** Quantized temperature -> color scale shared by both levels. */
function createColorScale() {
  const { colorDomain, colorBinCount } = SHARED_CONFIG;
  return d3.scaleQuantize()
    .domain(colorDomain)
    .range(d3.quantize(t => d3.interpolateSpectral(1 - t), colorBinCount));
}

/** Year axis on top, month axis on the left. */
function drawGridAxes(plot, xScale, yScale) {
  plot.append("g")
    .attr("class", "axis axis-year")
    .call(d3.axisTop(xScale).tickSizeOuter(0));

  plot.append("g")
    .attr("class", "axis axis-month")
    .call(d3.axisLeft(yScale)
      .tickFormat(m => SHARED_CONFIG.monthNames[m])
      .tickSizeOuter(0));
}

/**
 * Vertical legend: one swatch per color bin, labeled with the
 * domain endpoints. Returns the legend <g> and its height so callers
 * can append extra legend rows below it.
 */
function drawColorLegend(svg, colorScale, position) {
  const { legendSwatchWidth, legendSwatchHeight, legendLabelGap,
          colorDomain, legendUnitLabel } = SHARED_CONFIG;
  const binColors = colorScale.range();
  const legendHeight = binColors.length * legendSwatchHeight;

  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${position.x},${position.y})`);

  legend.selectAll("rect.legend-swatch")
    .data(binColors)
    .join("rect")
      .attr("class", "legend-swatch")
      .attr("y", (_, i) => i * legendSwatchHeight)
      .attr("width", legendSwatchWidth)
      .attr("height", legendSwatchHeight)
      .attr("fill", c => c);

  const labelX = legendSwatchWidth + legendLabelGap;
  legend.append("text")
    .attr("x", labelX).attr("y", legendSwatchHeight / 2)
    .attr("dominant-baseline", "middle")
    .text(`${colorDomain[0]} ${legendUnitLabel}`);
  legend.append("text")
    .attr("x", labelX).attr("y", legendHeight - legendSwatchHeight / 2)
    .attr("dominant-baseline", "middle")
    .text(`${colorDomain[1]} ${legendUnitLabel}`);

  return { legend, legendHeight };
}

/* ------------------------------------------------------------------ */
/* Interaction                                                         */
/* ------------------------------------------------------------------ */

/** Small wrapper around the floating tooltip <div>. */
function createTooltip(selector) {
  const tooltip = d3.select(selector);
  return {
    show(html) { tooltip.style("display", "block").html(html); },
    move(event) {
      tooltip
        .style("left", (event.pageX + SHARED_CONFIG.tooltipOffsetX) + "px")
        .style("top", (event.pageY + SHARED_CONFIG.tooltipOffsetY) + "px");
    },
    hide() { tooltip.style("display", "none"); }
  };
}

/**
 * Build the Max/Min buttons and manage the current mode.
 * `onChange(mode)` is called on start-up and every time the mode changes.
 * Returns { getMode, toggle } so cells can switch mode on click.
 */
function createModeToggle(containerSelector, onChange) {
  let currentMode = SHARED_CONFIG.defaultMode;
  const modeKeys = Object.keys(SHARED_CONFIG.modes);

  const buttons = d3.select(containerSelector)
    .selectAll("button")
    .data(modeKeys)
    .join("button")
      .text(key => SHARED_CONFIG.modes[key])
      .on("click", (_, key) => setMode(key));

  function setMode(mode) {
    currentMode = mode;
    buttons.classed("active", key => key === mode);
    onChange(mode);
  }

  /** Advance to the next mode (max -> min -> max ...). */
  function toggle() {
    const nextIndex = (modeKeys.indexOf(currentMode) + 1) % modeKeys.length;
    setMode(modeKeys[nextIndex]);
  }

  setMode(currentMode);
  return { getMode: () => currentMode, toggle };
}
