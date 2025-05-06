"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    XAxis,
    ResponsiveContainer,
    YAxis,
} from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

/**
 * Data item structure for chart data
 */
export interface ChartDataItem {
    [key: string]: string | number
}

/**
 * Trend information configuration
 */
export interface TrendInfo {
    /** Numeric trend value (percentage) */
    value: number
    /** Period text (e.g., "month", "year") */
    period?: string
    /** Custom trend text (overrides default based on value) */
    text?: string
    /** Custom icon component (overrides default based on value) */
    icon?: React.ComponentType<{ className?: string }>
}

/**
 * Footer configuration
 */
export interface FooterInfo {
    /** Footer text content */
    text?: string
    /** Additional CSS classes for footer text */
    className?: string
}

/**
 * Bar chart configuration options
 */
export interface BarChartOptions {
    /** Key for X-axis values in data items */
    xAxisKey: string
    /** Array of data keys to render as bars */
    dataKeys: string[]
    /** Function to format X-axis tick labels */
    xAxisFormatter?: (value: string) => string
    /** Whether to show data labels on bars */
    showLabels?: boolean
    /** Radius for bar corners (rounded corners) */
    barRadius?: number
    /** Whether to show grid lines */
    showGrid?: boolean
    /** Opacity for grid lines */
    gridStrokeOpacity?: number
    /** Gap between bars in a group */
    barGap?: number
    /** Size of individual bars */
    barSize?: number
    /** Whether to show legend */
    showLegend?: boolean
    /** Position of the legend */
    legendPosition?: 'top' | 'right' | 'bottom' | 'left'
    /** Whether to hide axis ticks */
    hideTicks?: boolean
    /** Whether to hide axis lines */
    hideAxis?: boolean
    /** Function to format label values */
    labelFormatter?: (value: number) => string | number
    /** Chart margins */
    margin?: {
        top?: number
        right?: number
        bottom?: number
        left?: number
    }
    /** Whether to stack the bars */
    stacked?: boolean
    /** Additional chart aria label for accessibility */
    ariaLabel?: string
    /** Additional chart aria description for accessibility */
    ariaDescription?: string
}

/**
 * Performance Bar Chart component props
 */
export interface PerformanceBarChartProps {
    /** Array of data items for the chart */
    data: ChartDataItem[]
    /** Chart configuration for colors and labels */
    config: ChartConfig
    /** Chart title */
    title?: string
    /** Chart description */
    description?: string
    /** Trend information */
    trend?: TrendInfo
    /** Footer information */
    footer?: FooterInfo
    /** Chart configuration options */
    chart: BarChartOptions
    /** Additional CSS classes for card container */
    className?: string
    /** Additional CSS classes for card header */
    headerClassName?: string
    /** Additional CSS classes for card content */
    contentClassName?: string
    /** Additional CSS classes for card footer */
    footerClassName?: string
    /** Chart height (default: 300) */
    height?: number | string
    /** ID for the chart (used for accessibility) */
    id?: string
}

// Breakpoint types for responsive handling
type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Responsive values based on breakpoints
interface ResponsiveValues {
    barSize: number
    barGap: number
    fontSize: number
    labelOffset: number
    isVerticalLayout: boolean
    hideLabels: boolean
    margins: {
        top: number
        right: number
        bottom: number
        left: number
    }
    tickInterval: number
}

/**
 * A high-performance, responsive bar chart component with trend indicators
 * and customizable styling options.
 */
export const PerformanceBarChart = React.memo(function PerformanceBarChart({
    data,
    config,
    title,
    description,
    trend,
    footer,
    chart,
    className,
    headerClassName,
    contentClassName,
    footerClassName,
    height = 300,
    id,
}: PerformanceBarChartProps) {
    // Memoize chart data to prevent unnecessary recalculations
    const chartData = React.useMemo(() => data, [data])

    // Container references for measuring dimensions
    const containerRef = React.useRef<HTMLDivElement>(null)
    // Initialize with a reasonable default to ensure initial render
    const [containerWidth, setContainerWidth] = React.useState<number>(600)
    const [containerHeight, setContainerHeight] = React.useState<number | string>(height)

    // Generate unique ID for chart accessibility
    const uniqueId = React.useId()
    const chartId = id || `performance-chart-${uniqueId.replace(/:/g, "")}`

    // Determine current breakpoint based on container width
    const breakpoint = React.useMemo((): Breakpoint => {
        if (containerWidth < 360) return 'xs'
        if (containerWidth < 640) return 'sm'
        if (containerWidth < 768) return 'md'
        if (containerWidth < 1024) return 'lg'
        return 'xl'
    }, [containerWidth])

 const calculateBarSize = React.useCallback((availableWidth: number) => {
    const maxBarsPerGroup = chart.dataKeys.length;
    const groupSpacing = 20;
    const barSpacing = 4;
    
    const totalGroups = chartData.length;
    const totalBarWidth = availableWidth - (totalGroups * groupSpacing);
    const barWidth = totalBarWidth / (totalGroups * maxBarsPerGroup);
    
    return Math.min(40, Math.max(barWidth - barSpacing, 8));
  }, [chartData.length, chart.dataKeys.length]);

    // Calculate responsive values based on breakpoint and data - more conservative approach
    const responsiveValues = React.useMemo((): ResponsiveValues => {
    const safeWidth = Math.max(300, containerWidth);
    const availableWidth = safeWidth - 60;
    const itemCount = chartData.length;
    const seriesCount = chart.dataKeys.length;

    const isMobile = safeWidth < 500;
    const isTablet = safeWidth >= 500 && safeWidth < 768;
    const isDesktop = safeWidth >= 768;

    const baseFontSize = isMobile ? 8 : isTablet ? 10 : 12;
    const barSize = chart.barSize || calculateBarSize(availableWidth);

    return {
      barSize,
      barGap: chart.barGap || (isMobile ? 2 : 4),
      fontSize: baseFontSize,
      labelOffset: isMobile ? 5 : 8,
      isVerticalLayout: shouldUseVerticalLayout,
      hideLabels: (isMobile && itemCount > 4) || (isTablet && itemCount > 6),
      margins: {
        top: chart.margin?.top ?? 20,
        right: chart.margin?.right ?? (isMobile ? 10 : 20),
        left: chart.margin?.left ?? (shouldUseVerticalLayout ? 80 : 20),
        bottom: chart.margin?.bottom ?? 30,
      },
      tickInterval: isMobile ? 1 : 0
    };
  }, [containerWidth, chartData.length, chart.dataKeys.length, chart.margin, chart.barSize, chart.barGap, shouldUseVerticalLayout]);    // If custom icon is provided, use it; otherwise determine based on trend
    const TrendIcon = React.useMemo(() => {
        if (!trend) return null
        if (trend.icon) return trend.icon
        if (trend.value > 0) return TrendingUp
        if (trend.value < 0) return TrendingDown
        return Minus
    }, [trend])

    // Format trend value with sign
    const formattedTrendValue = React.useMemo(() => {
        if (!trend) return ""
        const prefix = trend.value > 0 ? "+" : ""
        return `${prefix}${Math.abs(trend.value).toFixed(1)}%`
    }, [trend])

    // Generate appropriate trend text
    const trendText = React.useMemo(() => {
        if (!trend) return ""
        if (trend.text) return trend.text
        if (trend.value > 0) return "Trending up by"
        if (trend.value < 0) return "Trending down by"
        return "No change"
    }, [trend])

    // Get colors directly from config for each data key
    const getColorForDataKey = React.useCallback((dataKey: string): string => {
        if (!config[dataKey]) return "#000000"

        // Use color from the config if available
        if (config[dataKey].color) {
            return config[dataKey].color
        }

        // Use theme-based color if available
        const theme =
            typeof document !== 'undefined' && document?.documentElement?.classList?.contains("dark")
                ? "dark"
                : "light"

        return config[dataKey].theme?.[theme as "light" | "dark"] || "#000000"
    }, [config])

    // Memoize the bars to avoid unnecessary re-renders
    const chartBars = React.useMemo(() => {
        return chart.dataKeys.map((dataKey) => (
            <Bar
                key={dataKey}
                dataKey={dataKey}
                fill={getColorForDataKey(dataKey)}
                radius={chart.barRadius ?? Math.min(8, responsiveValues.barSize / 2)}
                stackId={chart.stacked ? "stack" : undefined}
                maxBarSize={responsiveValues.barSize}
                animationDuration={800}
                isAnimationActive={true}
            >
                {chart.showLabels !== false && !responsiveValues.hideLabels && (
                    <LabelList
                        dataKey={dataKey}
                        position={responsiveValues.isVerticalLayout ? "right" : "top"}
                        offset={responsiveValues.labelOffset}
                        className="fill-foreground"
                        fontSize={responsiveValues.fontSize}
                        formatter={chart.labelFormatter}
                    />
                )}
            </Bar>
        ))
    }, [
        chart.dataKeys,
        chart.barRadius,
        chart.showLabels,
        chart.labelFormatter,
        chart.stacked,
        getColorForDataKey,
        responsiveValues.isVerticalLayout,
        responsiveValues.hideLabels,
        responsiveValues.fontSize,
        responsiveValues.labelOffset,
        responsiveValues.barSize
    ])

    // Function to measure container dimensions - simplified for reliability
    const updateDimensions = React.useCallback(() => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const width = Math.round(rect.width)

        // Always update width to ensure proper rendering
        setContainerWidth(width > 0 ? width : 600)

        // Adjust height for all screen sizes
        if (typeof height === 'number') {
            // Ensure minimum height on small screens
            const minHeight = width < 400 ? 250 : 300
            const dynamicHeight = Math.max(minHeight, typeof height === 'number' ? height : 300)
            setContainerHeight(dynamicHeight)
        } else {
            setContainerHeight(height)
        }

    }, [height])

    // More aggressive resize detection
    React.useEffect(() => {
        if (typeof window === 'undefined') return

        // Function to force measurement
        const forceMeasure = () => {
            if (containerRef.current) {
                const width = containerRef.current.getBoundingClientRect().width
                setContainerWidth(width > 0 ? width : 600)
                updateDimensions()
            }
        }

        // Immediate measurement on mount
        forceMeasure()

        // Set multiple timers to ensure measurement happens
        const timers = [
            setTimeout(forceMeasure, 0),
            setTimeout(forceMeasure, 50),
            setTimeout(forceMeasure, 200),
            setTimeout(forceMeasure, 500)
        ]

        // Use both resize observer and window resize for maximum coverage
        const resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(updateDimensions)
        })

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current)
        }

        window.addEventListener('resize', updateDimensions)

        return () => {
            timers.forEach(clearTimeout)
            resizeObserver.disconnect()
            window.removeEventListener('resize', updateDimensions)
        }
    }, [updateDimensions])

    // Re-measure when data changes
    React.useEffect(() => {
        updateDimensions()
    }, [data, updateDimensions])

    return (
        <Card className={cn("w-full overflow-hidden transition-all duration-200 min-w-[300px]", className)}>
            {(title || description) && (
                <CardHeader className={cn("p-4 sm:p-6", headerClassName)}>
                    {title && <CardTitle className="text-lg sm:text-xl md:text-2xl">{title}</CardTitle>}
                    {description && (
                        <CardDescription className="text-xs sm:text-sm md:text-base">
                            {description}
                        </CardDescription>
                    )}
                </CardHeader>
            )}
            <CardContent className={cn(
                "p-1 sm:p-2 md:p-4 lg:p-6 overflow-hidden transition-all",
                contentClassName
            )}>
                <div
                    ref={containerRef}
                    className="w-full h-full relative overflow-visible rounded-md"
                    style={{
                        minHeight: typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight,
                        height: containerHeight
                    }}
                    aria-label={chart.ariaLabel || `Bar chart showing ${chart.dataKeys.join(", ")} data by ${chart.xAxisKey}`}
                    aria-description={chart.ariaDescription}
                    role="img"
                    id={chartId}
                >
                    {/* Always render the chart, even if containerWidth is still being calculated */}
                    <ChartContainer config={config}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                accessibilityLayer
                                data={chartData}
                                margin={responsiveValues.margins}
                                barGap={responsiveValues.barGap}
                                barSize={responsiveValues.barSize}
                                maxBarSize={responsiveValues.barSize}
                                layout={responsiveValues.isVerticalLayout ? "vertical" : "horizontal"}
                                className="transition-all duration-300"
                            >
                                {chart.showGrid !== false && (
                                    <CartesianGrid
                                        vertical={false}
                                        strokeOpacity={chart.gridStrokeOpacity ?? 0.5}
                                        strokeDasharray="3 3"
                                        className="transition-opacity duration-500"
                                    />
                                )}
                                <XAxis
                                    dataKey={chart.xAxisKey}
                                    tickLine={chart.hideTicks !== true}
                                    tickMargin={breakpoint === 'xs' ? 5 : 10}
                                    axisLine={chart.hideAxis !== true}
                                    tickFormatter={chart.xAxisFormatter}
                                    tick={{ fontSize: responsiveValues.fontSize }}
                                    interval={responsiveValues.tickInterval}
                                    type={responsiveValues.isVerticalLayout ? "number" : "category"}
                                    hide={responsiveValues.isVerticalLayout}
                                    angle={breakpoint === 'xs' || breakpoint === 'sm' ? -45 : 0}
                                    textAnchor={breakpoint === 'xs' || breakpoint === 'sm' ? "end" : "middle"}
                                    height={breakpoint === 'xs' || breakpoint === 'sm' ? 60 : 30}
                                />
                                <YAxis
                                    tickMargin={5}
                                    width={responsiveValues.isVerticalLayout ? (breakpoint === 'xs' ? 60 : 90) : undefined}
                                    dataKey={responsiveValues.isVerticalLayout ? chart.xAxisKey : undefined}
                                    hide={!responsiveValues.isVerticalLayout}
                                    type={responsiveValues.isVerticalLayout ? "category" : "number"}
                                    tick={{ fontSize: responsiveValues.fontSize }}
                                    tickFormatter={responsiveValues.isVerticalLayout ? chart.xAxisFormatter : undefined}
                                    minTickGap={5}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                    wrapperClassName="transition-opacity duration-150"
                                />
                                {chart.showLegend && (
                                    <ChartLegend
                                        content={<ChartLegendContent />}
                                        verticalAlign={chart.legendPosition === 'bottom' ? 'bottom' : 'top'}
                                        align={chart.legendPosition === 'right' ? 'right' : chart.legendPosition === 'left' ? 'left' : 'center'}
                                        wrapperStyle={{
                                            fontSize: responsiveValues.fontSize,
                                            padding: breakpoint === 'xs' ? '0px' : '10px'
                                        }}
                                        iconSize={breakpoint === 'xs' ? 8 : breakpoint === 'sm' ? 10 : 14}
                                        iconType="circle"
                                    />
                                )}
                                {chartBars}
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
            </CardContent>
            {(trend || footer?.text) && (
                <CardFooter className={cn(
                    "flex-col items-start gap-1 sm:gap-2 text-xs sm:text-sm p-4 sm:p-6",
                    footerClassName
                )}>
                    {trend && trend.value !== 0 && (
                        <div className="flex items-center gap-1 sm:gap-2 font-medium leading-none">
                            {trendText}{" "}
                            <span className={cn(
                                "font-semibold",
                                trend.value > 0 ? "text-green-600 dark:text-green-400" :
                                    trend.value < 0 ? "text-red-600 dark:text-red-400" : ""
                            )}>
                                {formattedTrendValue}
                            </span>{" "}
                            {trend.period && (
                                <span className="text-muted-foreground">this {trend.period}</span>
                            )}{" "}
                            {TrendIcon && (
                                <TrendIcon className={cn(
                                    "h-3 w-3 sm:h-4 sm:w-4 transition-colors",
                                    trend.value > 0 ? "text-green-600 dark:text-green-400" :
                                        trend.value < 0 ? "text-red-600 dark:text-red-400" : ""
                                )} />
                            )}
                        </div>
                    )}
                    {footer?.text && (
                        <div className={cn(
                            "leading-tight text-muted-foreground text-xs",
                            footer.className
                        )}>
                            {footer.text}
                        </div>
                    )}
                </CardFooter>
            )}
        </Card>
    )
})

/**
 * Example usage - Single data series bar chart with trend indicator
 */
export function SingleBarChartExample() {
    const chartData = [
        { month: "January", desktop: 186 },
        { month: "February", desktop: 305 },
        { month: "March", desktop: 237 },
        { month: "April", desktop: 73 },
        { month: "May", desktop: 209 },
        { month: "June", desktop: 214 },
    ]

    const chartConfig = {
        desktop: {
            label: "Desktop",
            color: "hsl(215, 90%, 50%)", // Direct HSL color value
        },
    } satisfies ChartConfig

    return (
        <PerformanceBarChart
            data={chartData}
            config={chartConfig}
            title="Bar Chart - Label"
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
                text: "Showing total visitors for the last 6 months",
            }}
        />
    )
}

/**
 * Example usage - Multi-series stacked bar chart with legend
 */
export function MultiSeriesBarChartExample() {
    const data = [
        { month: "January", desktop: 186, mobile: 125, tablet: 85 },
        { month: "February", desktop: 305, mobile: 148, tablet: 92 },
        { month: "March", desktop: 237, mobile: 275, tablet: 118 },
        { month: "April", desktop: 73, mobile: 187, tablet: 64 },
        { month: "May", desktop: 209, mobile: 316, tablet: 127 },
        { month: "June", desktop: 214, mobile: 358, tablet: 143 },
    ]

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
    } satisfies ChartConfig

    return (
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
                stacked: true,
                margin: {
                    top: 30,
                    right: 30,
                    bottom: 5,
                    left: 10
                },
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
    )
}
