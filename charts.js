/**
 * Charts Module for Smart Fridge & Ledger
 * Configures and renders Chart.js charts with warm, friendly pastel aesthetics.
 * Receives pre-aggregated data and supports dynamic user-defined categories.
 */

class LedgerCharts {
  constructor() {
    this.pieChart = null;
    this.barChart = null;
    this.theme = 'light';
    
    // Core default categories config
    this.categories = {
      food: { label: '食費', color: '#ff7a59' },
      eat_out: { label: '外食', color: '#f1a208' },
      daily_necessities: { label: '日用品', color: '#3ab795' },
      utilities: { label: '光熱費', color: '#5fa8d3' },
      entertainment: { label: '娯楽費', color: '#d972ff' },
      travel_telecom: { label: '交通・通信費', color: '#4cc9f0' },
      other: { label: 'その他', color: '#ee6c4d' }
    };
  }

  setTheme(newTheme) {
    this.theme = newTheme;
    this.updateChartStyles();
  }

  getChartColors() {
    const isDark = this.theme === 'dark';
    return {
      text: isDark ? '#bbaea3' : '#857463', 
      grid: isDark ? 'rgba(230, 218, 201, 0.05)' : 'rgba(133, 116, 99, 0.08)',
      tooltipBg: isDark ? 'rgba(40, 34, 28, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      tooltipText: isDark ? '#ebdcd0' : '#4a3f35',
      tooltipBorder: isDark ? 'rgba(94, 80, 68, 0.5)' : 'rgba(230, 218, 201, 0.8)'
    };
  }

  updateChartStyles() {
    const colors = this.getChartColors();
    if (this.pieChart) {
      this.pieChart.options.plugins.legend.labels.color = colors.text;
      this.pieChart.options.borderColor = this.theme === 'dark' ? '#28221c' : '#ffffff';
    }
    if (this.barChart) {
      this.barChart.options.scales.x.ticks.color = colors.text;
      this.barChart.options.scales.y.ticks.color = colors.text;
      this.barChart.options.scales.x.grid.color = colors.grid;
      this.barChart.options.scales.y.grid.color = colors.grid;
    }
    this.pieChart?.update();
    this.barChart?.update();
  }

  /**
   * Generates a deterministic pastel HSL color based on string input
   */
  generatePastelColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Pastel properties: Lightness 65-70%, Saturation 70-80%
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 75%, 65%)`;
  }

  /**
   * Render Category Doughnut Chart
   * @param {string} canvasId
   * @param {Object} categoryTotals - e.g. { food: 1200, eat_out: 4000, "自炊特別": 500 }
   */
  renderPieChart(canvasId, categoryTotals) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Dynamically register new custom categories from totals data
    Object.keys(categoryTotals).forEach(key => {
      if (!this.categories[key] && categoryTotals[key] > 0) {
        this.categories[key] = {
          label: key, // Custom category name
          color: this.generatePastelColor(key)
        };
      }
    });

    const labels = [];
    const data = [];
    const backgroundColor = [];

    // Map data for categories that have values > 0
    Object.keys(this.categories).forEach(key => {
      const value = categoryTotals[key] || 0;
      if (value > 0) {
        labels.push(this.categories[key].label);
        data.push(value);
        backgroundColor.push(this.categories[key].color);
      }
    });

    const colors = this.getChartColors();

    if (this.pieChart) {
      this.pieChart.data.labels = labels;
      this.pieChart.data.datasets[0].data = data;
      this.pieChart.data.datasets[0].backgroundColor = backgroundColor;
      this.pieChart.options.plugins.legend.labels.color = colors.text;
      this.pieChart.options.borderColor = this.theme === 'dark' ? '#28221c' : '#ffffff';
      this.pieChart.update();
      return;
    }

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColor,
          borderWidth: 3,
          borderColor: this.theme === 'dark' ? '#28221c' : '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: colors.text,
              font: {
                family: 'Kosugi Maru',
                size: 11,
                weight: 'bold'
              },
              padding: 10,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                return ` ${label}: ¥${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Render Monthly Expense Trend Bar Chart
   */
  renderBarChart(canvasId, monthlyData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getChartColors();

    if (this.barChart) {
      this.barChart.data.labels = monthlyData.labels;
      this.barChart.data.datasets[0].data = monthlyData.data;
      this.barChart.options.scales.x.ticks.color = colors.text;
      this.barChart.options.scales.y.ticks.color = colors.text;
      this.barChart.options.scales.x.grid.color = colors.grid;
      this.barChart.options.scales.y.grid.color = colors.grid;
      this.barChart.update();
      return;
    }

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthlyData.labels,
        datasets: [{
          label: '支出総額',
          data: monthlyData.data,
          backgroundColor: '#ff7a59',
          hoverBackgroundColor: '#ff623c',
          borderRadius: 10,
          borderSkipped: false,
          barPercentage: 0.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              color: colors.grid,
              drawBorder: false
            },
            ticks: {
              color: colors.text,
              font: {
                family: 'Kosugi Maru',
                size: 11
              }
            }
          },
          y: {
            grid: {
              color: colors.grid,
              drawBorder: false
            },
            ticks: {
              color: colors.text,
              font: {
                family: 'Kosugi Maru',
                size: 11
              },
              callback: function(value) {
                return '¥' + value.toLocaleString();
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                const value = context.parsed.y || context.parsed || 0;
                return ` 支出額: ¥${value.toLocaleString()}`;
              }
            }
          }
        }
      }
    });
  }
}

// Export a single instance globally
window.ledgerCharts = new LedgerCharts();
