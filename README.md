# CSCE679 Assignment 1 – Hong Kong Temperature Heatmap

D3.js (v7) visualizations of Hong Kong daily temperature data (`temperature_daily.csv`, 1997–2017).

## Files

| File | Description |
|------|-------------|
| `level1.html` | Level 1: year/month heatmap of monthly max or min temperature (1997–2017) |
| `level2.html` | Level 2: same heatmap for the last 10 years (2008–2017), with a mini line chart of daily max/min in each cell |
| `temperature_daily.csv` | Source data (`date`, `max_temperature`, `min_temperature`) |
| `level1.md` | Assignment instructions |

## How to run

Browsers block loading the CSV from `file://`, so serve the folder locally:

```bash
python3 -m http.server 8000
```

Then open:

- http://localhost:8000/level1.html
- http://localhost:8000/level2.html

An internet connection is needed to load D3 from the CDN.

## Features

### Level 1
- x-axis = year, y-axis = month; each cell is one month of one year.
- Cell color = highest daily max (or lowest daily min) of that month.
- Click any cell, or use the buttons, to toggle between max and min.
- Hover a cell to see the date and its max/min temperature.
- Legend maps colors to temperatures (0–40 °C).

### Level 2
- Same layout, color encoding, toggle, and legend as Level 1, limited to 2008–2017.
- Each cell contains a mini line chart: x = day of month, y = temperature.
  - Green line = daily max, light blue line = daily min.
  - All cells share one temperature scale, so lines are comparable across cells.
- Hover shows the monthly max/min plus the values of the day under the cursor.
