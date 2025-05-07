"use client";

import type React from "react";
import {
  type Statistics,
  transformPieChartData,
  transformWaterfallChartData,
} from "./types";
import PieChartComponent from "../charts/pie-chart";
import { WaterfallChart } from "../charts/waterfall-chart";

interface ChartRendererProps {
  statistics: Statistics;
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ statistics }) => {
  if (!statistics) {
    return null;
  }

  // Handle pie chart
  if (statistics.type === "pie_chart") {
    const chartData = transformPieChartData(statistics.data);
    return (
      <div className="w-full">
        <PieChartComponent
          title="Data Analysis"
          data={chartData}
          height={400}
          showLegend={true}
          valueFormatter={(value) => value.toLocaleString()}
        />
      </div>
    );
  }

  // Handle waterfall chart
  else if (statistics.type === "waterfall_chart") {
    const chartData = transformWaterfallChartData(statistics.data);
    return (
      <div className="w-full">
        <WaterfallChart
          data={chartData}
          height={400}
          positiveColor="hsl(160, 60%, 50%)"
          negativeColor="hsl(340, 80%, 65%)"
          totalColor="hsl(215, 70%, 60%)"
        />
      </div>
    );
  }

  // Fallback for unknown chart type
  return (
    <div className="p-4 border rounded-lg bg-yellow-50">
      <p className="text-yellow-700">
        Unknown chart type: {(statistics as any).type}
      </p>
    </div>
  );
};

export default ChartRenderer;
