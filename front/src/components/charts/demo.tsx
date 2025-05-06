"use client"
import React from "react";
import { PerformanceBarChart } from "./bar-chart";

export default function ChartDemo() {
  // Example data for monthly visits by device
  const data = [
    { month: "January", desktop: 186, mobile: 125, tablet: 85 },
    { month: "February", desktop: 305, mobile: 148, tablet: 92 },
    { month: "March", desktop: 237, mobile: 275, tablet: 118 },
    { month: "April", desktop: 73, mobile: 187, tablet: 64 },
    { month: "May", desktop: 209, mobile: 316, tablet: 127 },
    { month: "June", desktop: 214, mobile: 358, tablet: 143 },
  ];
  
  // Chart config with explicit colors
  const chartConfig = {
    desktop: {
      label: "Desktop",
      color: "#3b82f6", // Blue
    },
    mobile: {
      label: "Mobile",
      color: "#10b981", // Green
    },
    tablet: {
      label: "Tablet",
      color: "#f59e0b", // Amber
    },
  };
  
  return (
    <div className="flex flex-col gap-8 p-4 w-full">
      <h1 className="text-2xl font-bold">Performance Bar Chart Component</h1>
      
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Single Data Series Example</h2>
          <PerformanceBarChart
            data={data.map(item => ({ month: item.month, desktop: item.desktop }))}
            config={{
              desktop: {
                label: "Desktop",
                color: "#3b82f6", // Blue
              },
            }}
            title="Desktop Visitors"
            description="January - June 2024"
            chart={{
              xAxisKey: "month",
              dataKeys: ["desktop"],
              xAxisFormatter: (value) => value.slice(0, 3),
              showLabels: true,
            }}
            trend={{
              value: 5.2,
              period: "month",
            }}
            footer={{
              text: "Showing desktop visitors for the last 6 months",
            }}
            height={300}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Multi-Series Example</h2>
          <PerformanceBarChart
            data={data}
            config={chartConfig}
            title="Device Breakdown"
            description="January - June 2024"
            chart={{
              xAxisKey: "month",
              dataKeys: ["desktop", "mobile", "tablet"],
              xAxisFormatter: (value) => value.slice(0, 3),
              showLabels: true,
              showLegend: true,
              legendPosition: "top",
              barGap: 5,
            }}
            trend={{
              value: 12.8,
              period: "quarter",
              text: "Overall growth of",
            }}
            footer={{
              text: "Showing device breakdown for the last 6 months",
            }}
            height={400}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Stacked Bar Example</h2>
          <PerformanceBarChart
            data={data}
            config={chartConfig}
            title="Combined Device Usage"
            description="January - June 2024 (Stacked)"
            chart={{
              xAxisKey: "month",
              dataKeys: ["desktop", "mobile", "tablet"],
              xAxisFormatter: (value) => value.slice(0, 3),
              showLabels: true,
              showLegend: true,
              legendPosition: "top",
              stacked: true,
              barRadius: 4,
            }}
            trend={{
              value: 15.3,
              period: "year",
              text: "Year-over-year growth of",
            }}
            footer={{
              text: "Showing combined device usage across platforms",
            }}
            height={400}
          />
        </div>
      </div>
    </div>
  );
}
