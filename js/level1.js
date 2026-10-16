/**
 * level1.js
 * Level 1: Year/Month heatmap of Hong Kong monthly temperature.
 * Each cell is one month; its color is the monthly max or min temperature.
 * Depends on common.js.
 */

/* ------------------------------------------------------------------ */
/* Level 1 configuration                                               */
/* ------------------------------------------------------------------ */

const LEVEL1_CONFIG = {
  svgSelector: "#chart",
  tooltipSelector: "#tooltip",
  toggleSelector: ".controls",
  layout: {
    cellWidth: 40,
    cellHeight: 32,
    margin: { top: 30, right: 110, bottom: 10, left: 80 }
  }
};

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

/** Draw one colored rectangle per monthly record. */
function drawHeatmapCells(plot, monthlyRecords, xScale, yScale) {
  return plot.selectAll("rect.cell")
    .data(monthlyRecords)
    .join("rect")
      .attr("class", "cell")
      .attr("x", d => xScale(d.year))
      .attr("y", d => yScale(d.month))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth());
}

/** Tooltip text for a monthly cell, e.g. "Date: 2002-03; max: 28 min: 14". */
function monthTooltipHtml(record) {
  return `Date: ${formatYearMonth(record)}; max: ${record.max} min: ${record.min}`;
}

/** Hover shows the tooltip; click switches between max and min. */
function attachCellInteractions(cells, tooltip, modeToggle) {
  cells
    .on("mouseover", (_, d) => tooltip.show(monthTooltipHtml(d)))
    .on("mousemove", event => tooltip.move(event))
    .on("mouseout", () => tooltip.hide())
    .on("click", () => modeToggle.toggle());
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function renderLevel1() {
  const dailyRecords = await loadDailyTemperatures();
  const monthlyRecords = aggregateByMonth(dailyRecords);
  const years = getYearRange(monthlyRecords);

  const { svg, plot, innerWidth, innerHeight } =
    createChartArea(LEVEL1_CONFIG.svgSelector, years, LEVEL1_CONFIG.layout);
  const { xScale, yScale } = createGridScales(years, innerWidth, innerHeight);
  const colorScale = createColorScale();

  drawGridAxes(plot, xScale, yScale);
  const cells = drawHeatmapCells(plot, monthlyRecords, xScale, yScale);

  const { margin } = LEVEL1_CONFIG.layout;
  drawColorLegend(svg, colorScale, {
    x: margin.left + innerWidth + SHARED_CONFIG.legendOffsetX,
    y: margin.top
  });

  // Recolor every cell with the selected field (max or min)
  const recolorCells = mode => cells.transition()
    .duration(SHARED_CONFIG.transitionMs)
    .attr("fill", d => colorScale(d[mode]));

  const modeToggle = createModeToggle(LEVEL1_CONFIG.toggleSelector, recolorCells);
  const tooltip = createTooltip(LEVEL1_CONFIG.tooltipSelector);
  attachCellInteractions(cells, tooltip, modeToggle);
}

renderLevel1();
