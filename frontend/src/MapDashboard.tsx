import React, { useState, useEffect, useRef, useCallback } from 'react';
// import DeckGL from '@deck-gl/react'; // DeckGL は不要
// import { IconLayer } from '@deck-gl/layers'; // IconLayer は不要
import { Map, MapRef, ViewState, ScaleControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// import { api } from './api'; // api.ts は不要
// import { useInterval } from './useInterval'; // useInterval は不要

// --- 【修正】初期視点を環境変数から読み込む ---
const INITIAL_VIEW_STATE = {
  // 環境変数 VITE_INITIAL_LONGITUDE を読み込み、なければデフォルト値 (-0.1278) を使用
  longitude: parseFloat(import.meta.env.VITE_INITIAL_LONGITUDE || '-0.1278'),
  // 環境変数 VITE_INITIAL_LATITUDE を読み込み、なければデフォルト値 (51.5074) を使用
  latitude: parseFloat(import.meta.env.VITE_INITIAL_LATITUDE || '51.5074'),
  // 環境変数 VITE_INITIAL_ZOOM を読み込み、なければデフォルト値 (10) を使用
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
    position: 'absolute',
    bottom: '35px',
    right: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: '10px',
    borderRadius: '5px',
    zIndex: 1,
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }}>
    <h4 style={{ margin: '0 0 5px 0' }}>Speed (km/h)</h4>
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

// --- ベースマップスタイル定義 ---
type BaseMapStyleKey = "positron" | "darkmatter" | "osm-standard" | "satellite";

// ベースURLを環境変数から取得
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

const baseMapUrls: Record<BaseMapStyleKey, string> = {
  positron: `${apiBaseUrl}/api/map/style.json`,
  darkmatter: `${apiBaseUrl}/api/map/style-dark.json`,
  osmStandard: `${apiBaseUrl}/api/map/style-osm-standard.json`,
  satellite: `${apiBaseUrl}/api/map/style-satellite.json`,
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
    <div style={{
      position: 'absolute',
      bottom: '280px',
      right: '10px',
      zIndex: 1,
    }}
    >
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{
          backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px',
          padding: '5px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
        title="Change map style"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </button>

      {isMenuOpen && (
        <div style={{
          position: 'absolute', top: '35px', right: '0',
          backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '5px',
          borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
        }}>
          {(Object.keys(baseMapUrls) as BaseMapStyleKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSelectStyle(key)}
              style={{
                backgroundColor: currentStyle === key ? '#ddd' : '#fff',
                border: '1px solid #ccc', padding: '5px 10px', margin: '2px',
                cursor: 'pointer', fontSize: '12px', minWidth: '80px', textAlign: 'left',
              }}
            >
              {key === 'positron' ? 'Light' :
               key === 'darkmatter' ? 'Dark' :
               key === 'osmStandard' ? 'OSM' :
               key === 'satellite' ? 'Satellite' : key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- 【追加】レイヤー切り替えコンポーネント ---
interface LayerSwitcherProps {
  isFlowVisible: boolean;
  onToggleFlow: () => void;
  isIncidentsVisible: boolean;
  onToggleIncidents: () => void;
}

const LayerSwitcher: React.FC<LayerSwitcherProps> = ({
  isFlowVisible, onToggleFlow, isIncidentsVisible, onToggleIncidents
}) => (
  <div style={{
    position: 'absolute',
    top: '10px', // BaseMapSwitcher の下に配置
    right: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: '8px',
    borderRadius: '5px',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }}>
    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      <input
        type="checkbox"
        checked={isFlowVisible}
        onChange={onToggleFlow}
        style={{ marginRight: '5px', accentColor: 'black' }}
      />
      Traffic Flow
    </label>
    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: '5px' }}>
      <input
        type="checkbox"
        checked={isIncidentsVisible}
        onChange={onToggleIncidents}
        style={{ marginRight: '5px', accentColor: 'black' }}
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
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; content: string } | null>(null);
  const [popupInfo, setPopupInfo] = useState<{ longitude: number; latitude: number; content: string } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState<string>('');

  const [isFlowVisible, setIsFlowVisible] = useState(true);
  const [isIncidentsVisible, setIsIncidentsVisible] = useState(true);

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
            if (map.getLayer('tomtom-traffic-incident-layer')) {
                map.setLayoutProperty('tomtom-traffic-incident-layer', 'visibility', isIncidentsVisible ? 'visible' : 'none');
            }
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

  // --- Popup/Tooltipの内容を整形する関数 ---
  // 交通流 (Flow) 用
  const formatFlowContent = (properties: any): string => {
    // --- スタイルとアイコン定義 (Flow) ---
    const style = 'style="font-family: sans-serif; font-size: 12px; max-width: 250px; background-color: rgba(0,0,0,0.7); color: white; padding: 5px 8px; border-radius: 3px;"';
    // Google Fonts 'Directions Car' icon (white fill)
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#FFFFFF" style="vertical-align: middle; margin-right: 5px;"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;
    const title = `<strong style="font-size: 14px; display: flex; align-items: center; margin-bottom: 5px;">${iconSvg} Traffic Flow</strong>`;

    if (!properties) return `<div ${style}>${title}<br/>(No data)</div>`;

    // --- 動的ロジック ---
    const internalKeys = new Set(['$type', 'layer', 'source', 'sourceLayer', 'state', 'tile']);
    const lines: string[] = [];
    for (const key in properties) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && !internalKeys.has(key)) {
            const value = properties[key];
            if (value !== undefined && value !== null) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

                // traffic_level の場合に ' km/h' を付記
                let displayValue = String(value);
                if (key === 'traffic_level') {
                    displayValue += ' km/h';
                }

                lines.push(`<span style="overflow-wrap: break-word;"><strong>${formattedKey}:</strong> ${displayValue}</span>`);
            }
        }
    }
    lines.sort();

    const content = (lines.length === 0)
        ? "(No detailed info available)"
        : `<div style="display: flex; flex-direction: column; gap: 4px;">${lines.join('')}</div>`;

    return `<div ${style}>${title}${content}</div>`;
  };

  // --- ISO 8601 形式の日付を 'YYYY-MM-DD HH:mm:ss UTC' に変換するヘルパー関数 ---
  const formatDateUTC = (isoString: string): string => {
    try {
        const date = new Date(isoString);
        // 無効な日付の場合は元の文字列を返す
        if (isNaN(date.getTime())) {
            return isoString;
        }

        // UTCコンポーネントを取得
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // 月は0-indexed
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
    } catch (e) {
        return isoString; // エラー時も元の文字列を返す
    }
  };

  // インシデント (Incident) 用
  const formatIncidentContent = (properties: any): string => {
    // --- スタイルとアイコン定義 (Incident) ---
    const style = 'style="font-family: sans-serif; font-size: 12px; max-width: 250px; background-color: #FFF9C4; color: black; padding: 5px 8px; border-radius: 3px; border: 1px solid #E0E0E0;"';
    // Google Fonts 'Warning' icon (black fill)
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="#000000" style="vertical-align: middle; margin-right: 5px;"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
    const title = `<strong style="font-size: 14px; display: flex; align-items: center; margin-bottom: 5px;">${iconSvg} Traffic Incident</strong>`;

    if (!properties) return `<div ${style}>${title}<br/>(No data)</div>`;

    // --- Icon Category の定義マップ ---
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
    // --- 動的ロジック ---
    const internalKeys = new Set(['$type', 'layer', 'source', 'sourceLayer', 'state', 'tile']);
    // 日付としてフォーマットするキーのリスト
    const dateKeys = new Set(['end_date', 'last_report_time']);

    const lines: string[] = [];
    for (const key in properties) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && !internalKeys.has(key)) {
            const value = properties[key];
            if (value !== undefined && value !== null) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

                let displayValue = String(value);

                if (key === 'delay') {
                    // 1. delay に 's' を付記
                    displayValue = `${String(value)} s`;

                } else if (key === 'magnitude') {
                    // 2. magnitude に意味を付記
                    let magnitudeText = 'Unknown'; // 0 またはリスト外の場合
                    switch (Number(value)) {
                        case 1: magnitudeText = 'Minor'; break;
                        case 2: magnitudeText = 'Moderate'; break;
                        case 3: magnitudeText = 'Major'; break;
                        case 4: magnitudeText = 'Indefinite (road closures and other delays with an unstated length of time)'; break;
                    }
                    displayValue = `${String(value)}. ${magnitudeText}`;

                // --- icon_category_X のロジックをここに追加 ---
                } else if (key.startsWith('icon_category')) {
                    const numericValue = Number(value);
                    const description = iconCategoryMap[numericValue]; // マップから説明を取得

                    if (description !== undefined) {
                        displayValue = `${String(value)}. ${description}`; // "7 (Lane Closed)"
                    } else {
                        displayValue = `${String(value)}. Other`; // マップにない場合
                    }

                } else if (dateKeys.has(key) && typeof value === 'string' && value.endsWith('Z')) {
                    // (既存の日付フォーマット処理)
                    displayValue = formatDateUTC(value);
                }

                lines.push(`<span style="overflow-wrap: break-word;"><strong>${formattedKey}:</strong> ${displayValue}</span>`);
            }
        }
    }
    lines.sort();

    const content = (lines.length === 0)
        ? "(No detailed info available)"
        : `<div style="display: flex; flex-direction: column; gap: 4px;">${lines.join('')}</div>`;

    return `<div ${style}>${title}${content}</div>`;
  };

  // --- マウスホバー時の処理 ---
  const handleMouseMove = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const { features, point } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    const incidentFeature = features && features.find(f =>
        // f.layer.id === 'tomtom-traffic-incident-point-layer' ||
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );

    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = (flowFeature || incidentFeature) ? 'pointer' : '';

    let content = "";
    if (incidentFeature) { // インシデントを優先
      content = formatIncidentContent(incidentFeature.properties);
    } else if (flowFeature) { // 次に交通流
      content = formatFlowContent(flowFeature.properties);
    }

    if (content) {
      setHoverInfo({ x: point.x, y: point.y, feature: incidentFeature || flowFeature });
      setTooltipContent(content);
      setPopupInfo(null);
    } else {
      setHoverInfo(null);
    }
  }, []); // 依存配列は空

  // --- クリック時の処理 ---
  const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const { features, lngLat } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    // 3つのレイヤーIDのいずれかに一致するかをチェック
    const incidentFeature = features && features.find(f =>
        // f.layer.id === 'tomtom-traffic-incident-point-layer' ||
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );

    let featureToShow = null;
    let content = "";

    if (incidentFeature) {
        featureToShow = incidentFeature;
        content = formatIncidentContent(featureToShow.properties);
    } else if (flowFeature) {
        featureToShow = flowFeature;
        content = formatFlowContent(featureToShow.properties);
    }

    if (featureToShow) {
        setHoverInfo(null);
        setPopupInfo({
            longitude: lngLat.lng,
            latitude: lngLat.lat,
            content: content
        });
    } else {
        setPopupInfo(null);
    }
  }, []); // 依存配列は空

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
            tooltipRef.current.style.visibility = 'hidden';
        }
  }, [hoverInfo, tooltipContent]);

  // --- ホバー用ツールチップ ---
  const renderTooltip = () => {
        if (!hoverInfo || !tooltipContent) return null;

        // 【修正】 ツールチップのコンテナからは背景色やパディングを削除
        // スタイルは format 関数が返すHTMLにすべて含まれる
        const tooltipStyle: React.CSSProperties = {
            position: 'absolute',
            zIndex: 1002,
            pointerEvents: 'none',
            transformOrigin: 'top left',
            visibility: 'hidden',
        };

        return (
            <div ref={tooltipRef} style={tooltipStyle}
              dangerouslySetInnerHTML={{ __html: tooltipContent }}
            />
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

        // --- インシデントレイヤーIDの配列 ---
        const incidentLayerIds = [
            // 'tomtom-traffic-incident-point-layer',
            'tomtom-traffic-incident-layer-outline',
            'tomtom-traffic-incident-layer-dash'
        ];

        // 3つのレイヤーすべてをトグルする
        incidentLayerIds.forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', isIncidentsVisible ? 'visible' : 'none');
            }
        });

    } catch (error) {
        console.error("Error setting layer visibility (style might be changing):", error);
    }
  }, [isFlowVisible, isIncidentsVisible, currentMapStyleKey]); // マップスタイル切り替え時にも実行


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
        //  3つのインシデントレイヤーIDすべてをインタラクティブ対象にする
        interactiveLayerIds={[
            'tomtom-traffic-layer', // 交通流
            // 'tomtom-traffic-incident-point-layer', // インシデント (Point)
            'tomtom-traffic-incident-layer-outline', // インシデント (Line 外枠)
            'tomtom-traffic-incident-layer-dash' // インシデント (Line 中心)
        ]}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
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
                <div dangerouslySetInnerHTML={{ __html: popupInfo.content }} />
              </Popup>
          )}
      </Map>

      {renderTooltip()}
      <Legend />
      <BaseMapSwitcher currentStyle={currentMapStyleKey} onChangeStyle={setCurrentMapStyleKey} />
      {/* 【追加】レイヤー切り替えUI */}
      <LayerSwitcher
        isFlowVisible={isFlowVisible}
        onToggleFlow={() => setIsFlowVisible(!isFlowVisible)}
        isIncidentsVisible={isIncidentsVisible}
        onToggleIncidents={() => setIsIncidentsVisible(!isIncidentsVisible)}
      />
    </div>
  );
}

export default MapDashboard;
