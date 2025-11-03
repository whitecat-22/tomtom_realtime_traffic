import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, MapRef, ViewState, ScaleControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// --- react-icons のインポート ---
import {
  LuMap, LuLayers, LuTriangleAlert,
  LuPlus, LuMinus, LuChevronUp, LuChevronDown, LuGlobe
} from 'react-icons/lu';
import { FaCar } from 'react-icons/fa6';

// --- 初期視点を環境変数から読み込む ---
const INITIAL_VIEW_STATE = {
  longitude: parseFloat(import.meta.env.VITE_INITIAL_LONGITUDE || '-0.1278'),
  latitude: parseFloat(import.meta.env.VITE_INITIAL_LATITUDE || '51.5074'),
  zoom: parseInt(import.meta.env.VITE_INITIAL_ZOOM || '10', 10),
  pitch: 0,
  bearing: 0
};

// --- 凡例データ ---
const legendData = [
  { speed: ' 0-10', color: '#f73027' },
  { speed: '10-20', color: '#fc8d59' },
  { speed: '20-30', color: '#fdbb2d' },
  { speed: '30-40', color: '#7cb342' },
  { speed: '40-50', color: '#56B458' },
  { speed: '50-60', color: '#1a9850' },
  { speed: '60-70', color: '#26c6da' },
  { speed: '70-80', color: '#007bfa' },
  { speed: '80-',   color: '#004CB0' },
];

// --- 凡例コンポーネント ---
const Legend = () => (
  <div style={{
    // ダークテーマ
    backgroundColor: 'rgba(30,30,30,0.8)',
    color: 'white',
    border: '1px solid #555',
    padding: '10px',
    borderRadius: '5px',
    zIndex: 1,
    fontFamily: 'sans-serif',
    fontSize: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  }}>
    <h4 style={{ margin: '0 0 5px 0', color: 'white' }}>Speed (km/h)</h4>
    {legendData.map((item) => (
      <div key={item.speed} style={{ marginBottom: '3px' }}>
        <span style={{
          display: 'inline-block',
          width: '15px',
          height: '15px',
          backgroundColor: item.color,
          marginRight: '5px',
          verticalAlign: 'middle',
        }}></span>
        <span>{item.speed}</span>
      </div>
    ))}
  </div>
);

// --- カーソル座標表示コンポーネント ---
const CursorCoordinates = ({ coords }: { coords: { lng: number; lat: number } | null }) => {
  if (!coords) return null;

  // 度 + 10進数の分 (小数点2桁)
  const toDegMin = (decimal: number, isLat: boolean) => {
      const degrees = Math.floor(Math.abs(decimal));
      // 5.23 -> 05.23, 55.23 -> 55.23
      const minutes = ((Math.abs(decimal) - degrees) * 60).toFixed(2);
      const direction = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
      // 末尾の "'" を削除
      return `${degrees}° ${String(minutes).padStart(5, '0')} ${direction}`;
  };

  return (
      <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '3px 8px',
          borderRadius: '3px',
          zIndex: 1,
          fontFamily: 'sans-serif',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          height: 'fit-content',
          // alignSelf: 'flex-end' から 'center' に変更 (親コンテナで制御)
          alignSelf: 'center',
      }}>
          <LuGlobe size={14} />
          {/* 3行フォーマット */}
          <div style={{ lineHeight: '1.3' }}>
              {/* textAlign: 'right' を追加 */}
              <div style={{ textAlign: 'right' }}>{toDegMin(coords.lat, true)}</div>
              <div style={{ textAlign: 'right' }}>{toDegMin(coords.lng, false)}</div>
              <div style={{ fontSize: '10px' }}>
                  ({coords.lat.toFixed(6)}, {coords.lng.toFixed(6)})
              </div>
          </div>
      </div>
  );
};


// --- ベースマップスタイル定義 ---
type BaseMapStyleKey = "positron" | "darkmatter" | "osm-standard" | "satellite";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
const baseMapUrls: Record<BaseMapStyleKey, string> = {
  positron: `${apiBaseUrl}/api/map/style.json`,
  darkmatter: `${apiBaseUrl}/api/map/style-dark.json`,
  osmStandard: `${apiBaseUrl}/api/map/style-osm-standard.json`,
  satellite: `${apiBaseUrl}/api/map/style-satellite.json`,
};

// --- 共通ボタンスタイル (ダークテーマ) ---
const controlButtonStyle: React.CSSProperties = {
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    borderTop: 'none',
    padding: '5px',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box', // ズームレベル表示の幅ズレ修正
};

// --- ベースマップ切り替えボタンコンポーネント ---
interface BaseMapSwitcherProps {
  currentStyle: BaseMapStyleKey;
  onChangeStyle: (styleKey: BaseMapStyleKey) => void;
}

const BaseMapSwitcher: React.FC<BaseMapSwitcherProps> = ({ currentStyle, onChangeStyle }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSelectStyle = (styleKey: BaseMapStyleKey) => {
    onChangeStyle(styleKey);
    setIsMenuOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        // 独立したボタンのため borderTop を設定
        style={{ ...controlButtonStyle, borderTop: '1px solid #555', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
        title="Change map style"
      >
        <LuMap size={20} />
      </button>

      {isMenuOpen && (
        <div style={{
          position: 'absolute', top: '0', right: '40px',
          // ダークテーマ
          backgroundColor: 'rgba(30,30,30,0.8)',
          color: 'white',
          border: '1px solid #555',
          padding: '10px',
          borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          width: '120px',
          zIndex: 2,
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #555', paddingBottom: '4px', color: 'white' }}>Map type</h4>

          {/* --- ラジオボタンに変更 --- */}
          {(Object.keys(baseMapUrls) as BaseMapStyleKey[]).map((key) => {
              const label = key === 'positron' ? 'Light' :
                            key === 'darkmatter' ? 'Dark' :
                            key === 'osmStandard' ? 'OSM' :
                            key === 'satellite' ? 'Satellite' : key;
              return (
                  <label key={key} style={{
                      display: 'block', cursor: 'pointer', padding: '4px 0',
                      color: 'white', fontSize: '13px'
                  }}>
                      <input
                          type="radio"
                          name="base-map-style"
                          checked={currentStyle === key}
                          onChange={() => handleSelectStyle(key)}
                          style={{ marginRight: '8px', accentColor: 'white' }}
                      />
                      {label}
                  </label>
              );
          })}

        </div>
      )}
    </div>
  );
};

// --- レイヤー切り替えパネル ---
interface LayerMenuPanelProps {
  isFlowVisible: boolean;
  onToggleFlow: () => void;
  isIncidentsVisible: boolean;
  onToggleIncidents: () => void;
}

const LayerMenuPanel: React.FC<LayerMenuPanelProps> = ({
  isFlowVisible, onToggleFlow, isIncidentsVisible, onToggleIncidents
}) => (
  <div style={{
    position: 'absolute',
    top: '0',
    right: '40px',
    // ダークテーマ
    backgroundColor: 'rgba(30,30,30,0.8)',
    color: 'white',
    border: '1px solid #555',
    padding: '10px',
    borderRadius: '5px',
    zIndex: 1,
    width: '150px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }}>
    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #555', paddingBottom: '4px', color: 'white' }}>Layers</h4>
    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white' }}>
      <input
        type="checkbox"
        checked={isFlowVisible}
        onChange={onToggleFlow}
        style={{ marginRight: '5px', accentColor: 'white' }}
      />
      Traffic Flow
    </label>
    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: '5px', color: 'white' }}>
      <input
        type="checkbox"
        checked={isIncidentsVisible}
        onChange={onToggleIncidents}
        style={{ marginRight: '5px', accentColor: 'white' }}
      />
      Traffic Incidents
    </label>
  </div>
);


// --- メインコンポーネント ---
function MapDashboard() {
  const [viewState, setViewState] = useState<Partial<ViewState>>(INITIAL_VIEW_STATE);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [currentMapStyleKey, setCurrentMapStyleKey] = useState<BaseMapStyleKey>("positron");
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number } | null>(null);
  const [popupInfo, setPopupInfo] = useState<{ longitude: number; latitude: number; content: React.ReactNode } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);

  const [isFlowVisible, setIsFlowVisible] = useState(true);
  const [isIncidentsVisible, setIsIncidentsVisible] = useState(true);

  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lng: number; lat: number } | null>(null);


  const mapStyleUrl = baseMapUrls[currentMapStyleKey];

  const handleMapMove = useCallback((e: any) => {
      if (e.viewState) { setViewState(e.viewState); }
  }, []);

  const handleMapIdle = useCallback(() => {
    //
  }, []);

  const handleMapLoad = useCallback(() => {
      console.log('Map loaded via Map onLoad');
      // マップロード時にレイヤーの初期表示状態をセット
      const map = mapRef.current?.getMap();
      if (!map) return;

      const setInitialVisibility = () => {
        try {
            if (map.getLayer('tomtom-traffic-layer')) {
                map.setLayoutProperty('tomtom-traffic-layer', 'visibility', isFlowVisible ? 'visible' : 'none');
            }
            const incidentLayerIds = [
                'tomtom-traffic-incident-layer-outline',
                'tomtom-traffic-incident-layer-dash'
            ];
            incidentLayerIds.forEach(layerId => {
                if (map.getLayer(layerId)) {
                    map.setLayoutProperty(layerId, 'visibility', isIncidentsVisible ? 'visible' : 'none');
                }
            });
        } catch (error) {
            console.error("Error setting initial layer visibility (style might be changing):", error);
        }
      };

      if (map.isStyleLoaded()) {
        setInitialVisibility();
      } else {
        map.once('styledata', setInitialVisibility);
      }

  }, [isFlowVisible, isIncidentsVisible]);

  // --- Popup/Tooltipの内容を整形する関数 (JSX) ---
  // 交通流 (Flow) 用
  const formatFlowContent = (properties: any): React.ReactNode => {
    const style: React.CSSProperties = { fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 8px', borderRadius: '3px' };
    const title = (
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <FaCar size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Traffic Flow
        </strong>
    );
    if (!properties) return <div style={style}>{title}<br/>(No data)</div>;
    const internalKeys = new Set(['$type', 'layer', 'source', 'sourceLayer', 'state', 'tile']);
    const lines: React.ReactNode[] = [];
    const keys = Object.keys(properties).sort();
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && !internalKeys.has(key)) {
            const value = properties[key];
            if (value !== undefined && value !== null) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                let displayValue = String(value);
                if (key === 'traffic_level') {
                    displayValue += ' km/h';
                }
                lines.push(
                    <span style={{ overflowWrap: 'break-word' }} key={key}>
                        <strong>{formattedKey}:</strong> {displayValue}
                    </span>
                );
            }
        }
    }
    const content = (lines.length === 0)
        ? "(No detailed info available)"
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{lines}</div>;
    return <div style={style}>{title}{content}</div>;
  };

  // --- 日付フォーマット用ヘルパー関数 ---
  const formatDateUTC = (isoString: string): string => {
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            return isoString;
        }
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
    } catch (e) {
        return isoString;
    }
  };

  // インシデント (Incident) 用
  const formatIncidentContent = (properties: any): React.ReactNode => {
    const style: React.CSSProperties = { fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px', backgroundColor: 'rgba(255,249,196,0.9)', color: 'black', padding: '5px 8px', borderRadius: '3px', border: '1px solid #E0E0E0' };
    const title = (
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <LuTriangleAlert size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Traffic Incident
        </strong>
    );
    if (!properties) return <div style={style}>{title}<br/>(No data)</div>;
    const iconCategoryMap: { [key: number]: string } = {
        0: 'Unknown',
        1: 'Accident',
        2: 'Fog',
        3: 'Dangerous Conditions',
        4: 'Rain',
        5: 'Ice',
        6: 'Jam',
        7: 'Lane Closed',
        8: 'Road Closed',
        9: 'Road Works',
        10: 'Wind',
        11: 'Flooding',
        14: 'Broken Down Vehicle'
    };
    const internalKeys = new Set(['$type', 'layer', 'source', 'sourceLayer', 'state', 'tile']);
    const dateKeys = new Set(['end_date', 'last_report_time']);
    const lines: React.ReactNode[] = [];
    const keys = Object.keys(properties).sort();
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && !internalKeys.has(key)) {
            const value = properties[key];
            if (value !== undefined && value !== null) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                let displayValue = String(value);
                if (key === 'delay') {
                    displayValue = `${String(value)} s`;
                } else if (key === 'magnitude') {
                    let magnitudeText = 'Unknown';
                    switch (Number(value)) {
                        case 1: magnitudeText = 'Minor'; break;
                        case 2: magnitudeText = 'Moderate'; break;
                        case 3: magnitudeText = 'Major'; break;
                        case 4: magnitudeText = 'Indefinite'; break;
                    }
                    if (Number(value) === 4) {
                        displayValue = `${String(value)}. Indefinite (road closures and other delays with an unstated length of time)`;
                    } else {
                        displayValue = `${String(value)}. ${magnitudeText}`;
                    }
                } else if (key.startsWith('icon_category')) {
                    const numericValue = Number(value);
                    const description = iconCategoryMap[numericValue];
                    if (description !== undefined) {
                        displayValue = `${String(value)}. ${description}`;
                    } else {
                        displayValue = `${String(value)}. Other`;
                    }
                } else if (dateKeys.has(key) && typeof value === 'string' && value.endsWith('Z')) {
                    displayValue = formatDateUTC(value);
                }
                lines.push(
                    <span style={{ overflowWrap: 'break-word' }} key={key}>
                        <strong>{formattedKey}:</strong> {displayValue}
                    </span>
                );
            }
        }
    }
    const content = (lines.length === 0)
        ? "(No detailed info available)"
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{lines}</div>;
    return <div style={style}>{title}{content}</div>;
  };


  // --- マウスホバー時の処理 ---
  const handleMouseMove = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    // カーソル座標を更新
    setCursorCoords(event.lngLat);

    const { features, point } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    const incidentFeature = features && features.find(f =>
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );

    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = (flowFeature || incidentFeature) ? 'pointer' : '';

    let content: React.ReactNode = null;
    if (incidentFeature) {
      content = formatIncidentContent(incidentFeature.properties);
    } else if (flowFeature) {
      content = formatFlowContent(flowFeature.properties);
    }

    if (content) {
      setHoverInfo({ x: point.x, y: point.y });
      setTooltipContent(content);
      setPopupInfo(null);
    } else {
      setHoverInfo(null);
      setTooltipContent(null);
    }
  }, []);

  // --- 地図からマウスが離れた時の処理 ---
  const handleMouseOut = useCallback(() => {
    setCursorCoords(null);
  }, []);

  // --- クリック時の処理 ---
  const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const { features, lngLat } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    const incidentFeature = features && features.find(f =>
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );

    let featureToShow = null;
    let content: React.ReactNode = null;

    if (incidentFeature) {
        featureToShow = incidentFeature;
        content = formatIncidentContent(featureToShow.properties);
    } else if (flowFeature) {
        featureToShow = flowFeature;
        content = formatFlowContent(featureToShow.properties);
    }

    if (featureToShow) {
        setHoverInfo(null);
        setTooltipContent(null);
        setPopupInfo({
            longitude: lngLat.lng,
            latitude: lngLat.lat,
            content: content
        });
    } else {
        setPopupInfo(null);
    }
  }, []);

  // --- ツールチップの位置調整ロジック ---
  useEffect(() => {
        if (tooltipRef.current && hoverInfo && tooltipContent) {
            const tooltipElement = tooltipRef.current;
            const rect = tooltipElement.getBoundingClientRect();
            const tooltipHeight = rect.height;
            const tooltipWidth = rect.width;
            const tooltipOffset = 15;
            const windowHeight = window.innerHeight;
            const windowWidth = window.innerWidth;
            const bottomMargin = 50;
            const rightMargin = 10;

            let finalTop = hoverInfo.y + tooltipOffset;
            let finalLeft = hoverInfo.x + tooltipOffset;

            if (finalTop + tooltipHeight > windowHeight - bottomMargin) {
                finalTop = hoverInfo.y - tooltipHeight - tooltipOffset;
            }
            if (finalLeft + tooltipWidth > windowWidth - rightMargin) {
                finalLeft = hoverInfo.x - tooltipWidth - tooltipOffset;
            }
            if (finalTop < 0) { finalTop = tooltipOffset; }
            if (finalLeft < 0) { finalLeft = tooltipOffset; }

            tooltipElement.style.top = `${finalTop}px`;
            tooltipElement.style.left = `${finalLeft}px`;
            tooltipElement.style.visibility = 'visible';
        } else if (tooltipRef.current) {
            tooltipElement.style.visibility = 'hidden';
        }
  }, [hoverInfo, tooltipContent]);

  // --- ホバー用ツールチップ ---
  const renderTooltip = () => {
        if (!hoverInfo || !tooltipContent) return null;

        const tooltipStyle: React.CSSProperties = {
            position: 'absolute',
            zIndex: 1002,
            pointerEvents: 'none',
            transformOrigin: 'top left',
            visibility: 'hidden',
        };

        return (
            <div ref={tooltipRef} style={tooltipStyle}>
              {tooltipContent}
            </div>
        );
  };

  // --- レイヤー表示切り替えロジック ---
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) {
        return;
    }

    try {
        if (map.getLayer('tomtom-traffic-layer')) {
            map.setLayoutProperty('tomtom-traffic-layer', 'visibility', isFlowVisible ? 'visible' : 'none');
        }

        const incidentLayerIds = [
            'tomtom-traffic-incident-layer-outline',
            'tomtom-traffic-incident-layer-dash'
        ];

        incidentLayerIds.forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', isIncidentsVisible ? 'visible' : 'none');
            }
        });

    } catch (error) {
        console.error("Error setting layer visibility (style might be changing):", error);
    }
  }, [isFlowVisible, isIncidentsVisible, currentMapStyleKey]);

  // --- ズーム/ピッチ コントロール関数 ---
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const PITCH_LEVELS = [0, 30, 45, 60];
  const currentPitch = viewState.pitch || 0;

  const handlePitchUp = () => {
      const nextPitch = PITCH_LEVELS.find(p => p > currentPitch);
      mapRef.current?.easeTo({ pitch: nextPitch !== undefined ? nextPitch : PITCH_LEVELS[PITCH_LEVELS.length - 1] });
  };
  const handlePitchDown = () => {
      const prevPitch = [...PITCH_LEVELS].reverse().find(p => p < currentPitch);
      mapRef.current?.easeTo({ pitch: prevPitch !== undefined ? prevPitch : PITCH_LEVELS[0] });
  };

  // ダークテーマ
  const disabledControlButtonStyle: React.CSSProperties = {
      ...controlButtonStyle,
      cursor: 'not-allowed',
      backgroundColor: '#222',
      color: '#777'
  };


  // --- レンダリング ---
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {error && (
        <div style={{
          position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 0, 0, 0.8)', color: 'white', padding: '10px 20px',
          borderRadius: '5px', zIndex: 1001
        }}>
          {error}
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMapMove}
        onIdle={handleMapIdle}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyleUrl}
        initialViewState={INITIAL_VIEW_STATE}
        onLoad={handleMapLoad}
        attributionControl={true}
        interactiveLayerIds={[
            'tomtom-traffic-layer',
            'tomtom-traffic-incident-layer-outline',
            'tomtom-traffic-incident-layer-dash'
        ]}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseOut={handleMouseOut}
      >
          <ScaleControl unit="metric" position="bottom-left" />

          {popupInfo && (
              <Popup
                  longitude={popupInfo.longitude}
                  latitude={popupInfo.latitude}
                  closeButton={true}
                  closeOnClick={false}
                  onClose={() => setPopupInfo(null)}
                  anchor="bottom"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
              >
                {popupInfo.content}
              </Popup>
          )}
      </Map>

      {renderTooltip()}


      {/* --- Top Right UI Group --- */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {/* 1. Base Map */}
        <BaseMapSwitcher currentStyle={currentMapStyleKey} onChangeStyle={setCurrentMapStyleKey} />

        {/* 2. Layers */}
        <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
              style={{ ...controlButtonStyle, borderTop: '1px solid #555', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              title="Toggle layers"
            >
              <LuLayers size={20} />
            </button>
            {isLayerMenuOpen && (
                <LayerMenuPanel
                    isFlowVisible={isFlowVisible}
                    onToggleFlow={() => setIsFlowVisible(!isFlowVisible)}
                    isIncidentsVisible={isIncidentsVisible}
                    onToggleIncidents={() => setIsIncidentsVisible(!isIncidentsVisible)}
                />
            )}
        </div>

        {/* 3. Pitch */}
        <div style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden', borderTop: '1px solid #555' }}>
            <button
                onClick={handlePitchUp}
                style={(currentPitch >= 60) ? {...disabledControlButtonStyle, borderRadius: '4px 4px 0 0', borderTop: '1px solid #555'} : {...controlButtonStyle, borderRadius: '4px 4px 0 0', borderTop: '1px solid #555'}}
                title="Increase pitch"
                disabled={currentPitch >= 60}
            >
                <LuChevronUp size={18} />
            </button>
            <button
                onClick={handlePitchDown}
                style={(currentPitch <= 0) ? {...disabledControlButtonStyle, borderRadius: '0 0 4px 4px'} : {...controlButtonStyle, borderRadius: '0 0 4px 4px'}}
                title="Decrease pitch"
                disabled={currentPitch <= 0}
            >
                <LuChevronDown size={18} />
            </button>
        </div>
      </div>

      {/* --- Bottom Right UI Group --- */}
      <div style={{
          position: 'absolute',
          bottom: '35px',
          right: '10px',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px'
      }}>
          {/* 1. Legend */}
          <Legend />

          {/* 2. Coords + Zoom Group */}
          <div style={{
              display: 'flex',
              flexDirection: 'row',
              // 'flex-end' から 'center' に変更
              alignItems: 'center',
              gap: '8px'
          }}>
              {/* 2a. Coordinates */}
              <CursorCoordinates coords={cursorCoords} />

              {/* 2b. Zoom Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden', borderTop: '1px solid #555' }}>
                  <button onClick={handleZoomIn} style={{...controlButtonStyle, borderRadius: '4px 4px 0 0', borderTop: '1px solid #555'}} title="Zoom in">
                      <LuPlus size={18} />
                  </button>
                  <div style={{
                      ...controlButtonStyle,
                      borderTop: 'none',
                      cursor: 'default',
                      height: '32px',
                      fontSize: '12px', fontWeight: 'bold', fontFamily: 'sans-serif',
                      color: 'white',
                      backgroundColor: '#333',
                  }}>
                      {viewState.zoom?.toFixed(0)}
                  </div>
                  <button onClick={handleZoomOut} style={{...controlButtonStyle, borderRadius: '0 0 4px 4px'}} title="Zoom out">
                      <LuMinus size={18} />
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
}

export default MapDashboard;
