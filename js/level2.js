/**
 * level2.js
 * Level 2: Year/Month heatmap for the most recent years, where each cell
 * also contains a mini line chart of the daily max and min temperature.
 * Depends on common.js.
 */

/* ------------------------------------------------------------------ */
/* Level 2 configuration                                               */
/* ------------------------------------------------------------------ */

const LEVEL2_CONFIG = {
  svgSelector: "#chart",
  tooltipSelector: "#tooltip",
  toggleSelector: ".controls",
  yearCount: 10,                 // only the last N years are shown
  layout: {
    cellWidth: 90,
    cellHeight: 66,
    margin: { top: 30, right: 120, bottom: 10, left: 80 }
  },
  miniChart: {
    innerPadding: 4,             // gap between cell edge and line chart (px)
    maxDayOfMonth: 31
  },
  // Lines drawn inside each cell; `field` is the daily record key to plot
  lineSeries: [
    { field: "max", label: "Daily max", color: "#2ca02c" },
    { field: "min", label: "Daily min", color: "#a6cee3" }
  ],
  lineWidth: 1.8,
  lineLegendRowHeight: 20,
  lineLegendTopGap: 30           // gap between color legend and line legend
};

/* ------------------------------------------------------------------ */
/* Scales                                                              */
/* ------------------------------------------------------------------ */

/**
 * Scales for the mini line charts, shared by every cell so lines are
 * comparable across months: x = day of month, y = temperature.
 */
function createMiniChartScales(dailyRecords, cellWidth, cellHeight) {
  const { innerPadding, maxDayOfMonth } = LEVEL2_CONFIG.miniChart;
  return {
    dayScale: d3.scaleLinear()
      .domain([1, maxDayOfMonth])
      .range([innerPadding, cellWidth - innerPadding]),
    tempScale: d3.scaleLinear()
      .domain([d3.min(dailyRecords, d => d.min), d3.max(dailyRecords, d => d.max)])
      .range([cellHeight - innerPadding, innerPadding])
  };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

/** One <g> per monthly record, positioned at its grid cell. */
function drawCellGroups(plot, monthlyRecords, xScale, yScale) {
  return plot.selectAll("g.cell")
    .data(monthlyRecords)
    .join("g")
      .attr("class", "cell")
      .attr("transform", d => `translate(${xScale(d.year)},${yScale(d.month)})`);
}

/** Background rectangle of each cell (colored by max/min mode). */
function drawCellBackgrounds(cells, cellWidth, cellHeight) {
  return cells.append("rect")
    .attr("class", "cell-bg")
    .attr("width", cellWidth)
    .attr("height", cellHeight);
}

/** Draw one line per configured series (daily max, daily min) in every cell. */
function drawMiniLines(cells, dayScale, tempScale) {
  LEVEL2_CONFIG.lineSeries.forEach(series => {
    const lineGenerator = d3.line()
      .x(d => dayScale(d.date.getDate()))
      .y(d => tempScale(d[series.field]));

    cells.append("path")
      .attr("class", `mini-line mini-line-${series.field}`)
      .attr("fill", "none")
      .attr("stroke", series.color)
      .attr("stroke-width", LEVEL2_CONFIG.lineWidth)
      .attr("d", d => lineGenerator(d.days));
  });
}

/** Vertical dashed line marking the hovered day (hidden until hover). */
function drawDayMarkers(cells, cellHeight) {
  cells.append("line")
    .attr("class", "day-marker")
    .attr("y1", 0)
    .attr("y2", cellHeight)
    .style("display", "none");
}

/** Legend rows explaining the line colors, placed below the color legend. */
function drawLineLegend(legend, topOffset) {
  const { legendSwatchWidth, legendLabelGap } = SHARED_CONFIG;
  const { lineLegendRowHeight, lineWidth } = LEVEL2_CONFIG;

  const rows = legend.append("g")
    .attr("class", "line-legend")
    .attr("transform", `translate(0,${topOffset})`)
    .selectAll("g")
    .data(LEVEL2_CONFIG.lineSeries)
    .join("g")
      .attr("transform", (_, i) => `translate(0,${i * lineLegendRowHeight})`);

  rows.append("line")
    .attr("x1", 0).attr("x2", legendSwatchWidth)
    .attr("stroke", s => s.color)
    .attr("stroke-width", lineWidth);

  rows.append("text")
    .attr("x", legendSwatchWidth + legendLabelGap)
    .attr("dominant-baseline", "middle")
    .text(s => s.label);
}

/* ------------------------------------------------------------------ */
/* Interaction                                                         */
/* ------------------------------------------------------------------ */

/** Find the daily record in a month closest to the given day number. */
function findClosestDay(monthRecord, dayNumber) {
  return d3.least(monthRecord.days, d => Math.abs(d.date.getDate() - dayNumber));
}

/** Tooltip text: monthly summary plus the hovered day's values. */
function cellTooltipHtml(monthRecord, dayRecord) {
  const formatDate = d3.timeFormat("%Y-%m-%d");
  return `Date: ${formatYearMonth(monthRecord)}, max: ${monthRecord.max} min: ${monthRecord.min}<br>` +
         `${formatDate(dayRecord.date)}: max ${dayRecord.max} min ${dayRecord.min}`;
}

/**
 * Hover: show the tooltip and move the day marker to the day under the
 * cursor. Click: switch between max and min.
 */
function attachCellInteractions(cells, dayScale, tooltip, modeToggle) {
  cells
    .on("mousemove", function (event, monthRecord) {
      const [mouseX] = d3.pointer(event, this);
      const dayRecord = findClosestDay(monthRecord, Math.round(dayScale.invert(mouseX)));
      const markerX = dayScale(dayRecord.date.getDate());

      d3.select(this).select(".day-marker")
        .style("display", null)
        .attr("x1", markerX)
        .attr("x2", markerX);

      tooltip.show(cellTooltipHtml(monthRecord, dayRecord));
      tooltip.move(event);
    })
    .on("mouseleave", function () {
      d3.select(this).select(".day-marker").style("display", "none");
      tooltip.hide();
    })
    .on("click", () => modeToggle.toggle());
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function renderLevel2() {
  const allDailyRecords = await loadDailyTemperatures();
  const dailyRecords = filterLastYears(allDailyRecords, LEVEL2_CONFIG.yearCount);
  const monthlyRecords = aggregateByMonth(dailyRecords);
  const years = getYearRange(monthlyRecords);

  const { svg, plot, innerWidth, innerHeight } =
    createChartArea(LEVEL2_CONFIG.svgSelector, years, LEVEL2_CONFIG.layout);
  const { xScale, yScale } = createGridScales(years, innerWidth, innerHeight);
  const colorScale = createColorScale();
  const cellWidth = xScale.bandwidth();
  const cellHeight = yScale.bandwidth();
  const { dayScale, tempScale } = createMiniChartScales(dailyRecords, cellWidth, cellHeight);

  drawGridAxes(plot, xScale, yScale);
  const cells = drawCellGroups(plot, monthlyRecords, xScale, yScale);
  const backgrounds = drawCellBackgrounds(cells, cellWidth, cellHeight);
  drawMiniLines(cells, dayScale, tempScale);
  drawDayMarkers(cells, cellHeight);

  const { margin } = LEVEL2_CONFIG.layout;
  const { legend, legendHeight } = drawColorLegend(svg, colorScale, {
    x: margin.left + innerWidth + SHARED_CONFIG.legendOffsetX,
    y: margin.top
  });
  drawLineLegend(legend, legendHeight + LEVEL2_CONFIG.lineLegendTopGap);

  // Recolor every cell background with the selected field (max or min)
  const recolorCells = mode => backgrounds.transition()
    .duration(SHARED_CONFIG.transitionMs)
    .attr("fill", d => colorScale(d[mode]));

  const modeToggle = createModeToggle(LEVEL2_CONFIG.toggleSelector, recolorCells);
  const tooltip = createTooltip(LEVEL2_CONFIG.tooltipSelector);
  attachCellInteractions(cells, dayScale, tooltip, modeToggle);
}

renderLevel2();
