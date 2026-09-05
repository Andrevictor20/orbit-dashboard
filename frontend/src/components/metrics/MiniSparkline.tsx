import React from 'react';

interface MiniSparklineProps {
  data: number[];
  color: string;
  gradientId: string;
  height?: number;
  min?: number;
  max?: number;
  fillOpacity?: number;
  strokeWidth?: number;
  showDot?: boolean;
  secondaryData?: number[];
  secondaryColor?: string;
  secondaryGradientId?: string;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color,
  gradientId,
  height = 42,
  min: propMin,
  max: propMax,
  fillOpacity = 0.25,
  strokeWidth = 2,
  showDot = true,
  secondaryData,
  secondaryColor = '#38bdf8',
  secondaryGradientId = 'sparkSecondary',
}) => {
  // Se não houver dados ou houver menos de 2 pontos, sintetizar uma linha inicial suave com base no valor
  const primaryPoints = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    }
    if (data.length === 1) {
      const v = data[0];
      return [v, v, v, v, v, v, v, v];
    }
    // Pegar até os últimos 24 pontos para o mini gráfico
    return data.slice(-24);
  }, [data]);

  const secPoints = React.useMemo(() => {
    if (!secondaryData || secondaryData.length === 0) return null;
    if (secondaryData.length === 1) {
      const v = secondaryData[0];
      return [v, v, v, v, v, v, v, v];
    }
    return secondaryData.slice(-24);
  }, [secondaryData]);

  const width = 200;
  const h = height;

  // Calcular limites de escala
  const allValues = [...primaryPoints, ...(secPoints || [])];
  const calculatedMin = propMin !== undefined ? propMin : Math.min(0, ...allValues);
  const calculatedMax = propMax !== undefined ? propMax : Math.max(1, ...allValues);
  const range = calculatedMax - calculatedMin || 1;

  // Converter pontos em coordenadas (x, y)
  const getCoordinates = (points: number[]) => {
    const n = points.length;
    return points.map((val, idx) => {
      const x = n > 1 ? (idx / (n - 1)) * width : width / 2;
      const normalized = (val - calculatedMin) / range;
      // Inverter o eixo Y com margem superior/inferior de 3px
      const y = Math.max(3, Math.min(h - 3, h - 3 - normalized * (h - 8)));
      return { x, y };
    });
  };

  // Gerar caminho SVG suave com curvas Bézier cúbicas
  const buildSmoothPath = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(0, i - 1)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(coords.length - 1, i + 2)];

      // Controle de curvatura Catmull-Rom para Bézier
      const tension = 0.2;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    return d;
  };

  const primaryCoords = getCoordinates(primaryPoints);
  const primaryLinePath = buildSmoothPath(primaryCoords);
  const primaryLastPoint = primaryCoords[primaryCoords.length - 1];

  // Caminho fechado para o preenchimento com gradiente
  const primaryAreaPath = primaryCoords.length > 1
    ? `${primaryLinePath} L ${width},${h} L 0,${h} Z`
    : '';

  // Caminhos para a curva secundária (ex: rede TX/RX)
  let secCoords = null;
  let secLinePath = '';
  let secAreaPath = '';
  let secLastPoint = null;

  if (secPoints) {
    secCoords = getCoordinates(secPoints);
    secLinePath = buildSmoothPath(secCoords);
    secLastPoint = secCoords[secCoords.length - 1];
    secAreaPath = secCoords.length > 1
      ? `${secLinePath} L ${width},${h} L 0,${h} Z`
      : '';
  }

  return (
    <div className="w-full relative overflow-hidden select-none pointer-events-none" style={{ height: `${h}px` }}>
      <svg
        viewBox={`0 0 ${width} ${h}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Gradiente primário */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>

          {/* Gradiente secundário se houver */}
          {secPoints && (
            <linearGradient id={secondaryGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={secondaryColor} stopOpacity={fillOpacity * 0.75} />
              <stop offset="100%" stopColor={secondaryColor} stopOpacity={0.0} />
            </linearGradient>
          )}
        </defs>

        {/* Área secundária */}
        {secAreaPath && (
          <path d={secAreaPath} fill={`url(#${secondaryGradientId})`} />
        )}
        {/* Linha secundária */}
        {secLinePath && (
          <path
            d={secLinePath}
            fill="none"
            stroke={secondaryColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2,2"
            opacity={0.85}
          />
        )}

        {/* Área primária preenchida */}
        {primaryAreaPath && (
          <path d={primaryAreaPath} fill={`url(#${gradientId})`} />
        )}

        {/* Linha primária */}
        {primaryLinePath && (
          <path
            d={primaryLinePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Ponto pulsante indicador em tempo real na curva primária */}
        {showDot && primaryLastPoint && (
          <g>
            <circle
              cx={primaryLastPoint.x}
              cy={primaryLastPoint.y}
              r={4}
              fill={color}
              className="animate-ping opacity-60"
            />
            <circle
              cx={primaryLastPoint.x}
              cy={primaryLastPoint.y}
              r={2.5}
              fill={color}
            />
          </g>
        )}

        {/* Ponto na curva secundária se existir */}
        {showDot && secLastPoint && (
          <g>
            <circle
              cx={secLastPoint.x}
              cy={secLastPoint.y}
              r={2}
              fill={secondaryColor}
            />
          </g>
        )}
      </svg>
    </div>
  );
};
