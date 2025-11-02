import React, { useState, useEffect, useRef, useCallback } from 'react';
// import DeckGL from '@deck-gl/react'; // DeckGL を無効化
// import { IconLayer } from '@deck-gl/layers'; // IconLayer を無効化
import { Map, MapRef, ViewState, ScaleControl, Popup } from 'react-map-gl/maplibre'; // Popup をインポート
import 'maplibre-gl/dist/maplibre-gl.css';
// import { api } from './api'; // api.ts のインポートは不要に
// import { useInterval } from './useInterval'; // useInterval も不要に

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
  { speed: '80-', color: '#004CB0' },
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
      top: '10px',
      right: '10px',
      zIndex: 1,
    }}
      // onMouseEnter={() => setIsMenuOpen(true)}
      // onMouseLeave={() => setIsMenuOpen(false)}
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


// --- メインコンポーネント ---
function MapDashboard() {
  const [viewState, setViewState] = useState<Partial<ViewState>>(INITIAL_VIEW_STATE);
  const [error, setError] = useState<string | null>(null); // エラー表示用
  const mapRef = useRef<MapRef>(null);
  const [currentMapStyleKey, setCurrentMapStyleKey] = useState<BaseMapStyleKey>("positron");
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; feature: any } | null>(null);
  const [popupInfo, setPopupInfo] = useState<{ longitude: number; latitude: number; content: string } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);


  const mapStyleUrl = baseMapUrls[currentMapStyleKey];

  const handleMapMove = useCallback((e: any) => {
     if (e.viewState) { setViewState(e.viewState); }
  }, []);

  const handleMapIdle = useCallback(() => {
    // BBox や Zoom の更新は不要になった (Incident取得しないため)
  }, []);

  const handleMapLoad = useCallback(() => {
     console.log('Map loaded via Map onLoad');
     // BBox の初期設定も不要になった
  }, []);

   // --- Popupの内容を整形する関数 ---
   const formatPopupContent = (properties: any): string => {
       if (!properties) return "No data";
       // tags パラメータで取得した想定のプロパティ
       const roadType = properties.road_type !== undefined ? `Road Type: ${properties.road_type}` : "";
       const trafficLevel = properties.traffic_level !== undefined ? `Speed: ${properties.traffic_level} km/h` : "Speed: N/A";
       const coverage = properties.traffic_road_coverage !== undefined ? `Coverage: ${properties.traffic_road_coverage}` : "";
       const leftHand = properties.left_hand_traffic !== undefined ? `Left Hand Traffic: ${properties.left_hand_traffic}` : "";
       const closure = properties.road_closure !== undefined ? `Closure: ${properties.road_closure}` : "";
       const category = properties.road_category !== undefined ? `Category: ${properties.road_category}` : "";
       const subcategory = properties.road_subcategory !== undefined ? `Subcategory: ${properties.road_subcategory}` : "";

       // 表示する情報を整形
       const lines = [
           trafficLevel,
           coverage,
           roadType,
           `${category} ${subcategory}`.trim(),
           closure,
           leftHand
       ].filter(line => line && !line.includes('undefined') && !line.includes('N/A') && !line.endsWith(':') && line.trim() !== ''); // 空白のみの行も除外

        // lines 配列が空の場合のメッセージ
       if (lines.length === 0) return `<div style="font-family: sans-serif; font-size: 12px;">No detailed info available</div>`;

       return `
        <div style="font-family: sans-serif; font-size: 12px; max-width: 250px;">
            <strong>Traffic Info</strong><br/>
            ${lines.join('<br/>')}
        </div>
       `;
   };

  // --- マウスホバー時の処理 ---
  const handleMouseMove = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const { features, point } = event;
    const hoveredFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');

    if (mapRef.current) { mapRef.current.getMap().getCanvas().style.cursor = hoveredFeature ? 'pointer' : ''; }

    if (hoveredFeature) {
      setHoverInfo({ x: point.x, y: point.y, feature: hoveredFeature });
      setPopupInfo(null); // クリックPopupは閉じる
    } else {
      setHoverInfo(null);
    }
  }, []);

   // --- クリック時の処理 ---
   const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const { features, lngLat } = event;
    const clickedFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');

    if (clickedFeature) {
        setHoverInfo(null); // ホバーツールチップは閉じる
        setPopupInfo({
            longitude: lngLat.lng,
            latitude: lngLat.lat,
            content: formatPopupContent(clickedFeature.properties)
        });
    } else {
        setPopupInfo(null); // 地図の何もないところをクリックしたら閉じる
    }
   }, []);

   // --- ツールチップの位置調整ロジック ---
   useEffect(() => {
        if (tooltipRef.current && hoverInfo) {
            const tooltipElement = tooltipRef.current;
            const rect = tooltipElement.getBoundingClientRect();
            const tooltipHeight = rect.height;
            const tooltipWidth = rect.width;

            const tooltipOffset = 15;

            const windowHeight = window.innerHeight;
            const windowWidth = window.innerWidth;

            let finalTop = hoverInfo.y + tooltipOffset;
            let finalLeft = hoverInfo.x + tooltipOffset;

            const bottomMargin = 40;
            if (finalTop + tooltipHeight > windowHeight - bottomMargin) {
                finalTop = hoverInfo.y - tooltipHeight - tooltipOffset;
            }
            if (finalLeft + tooltipWidth > windowWidth) {
                finalLeft = hoverInfo.x - tooltipWidth - tooltipOffset;
            }
            if (finalTop < 0) {
                finalTop = tooltipOffset;
            }
            if (finalLeft < 0) {
                finalLeft = tooltipOffset;
            }

            tooltipElement.style.top = `${finalTop}px`;
            tooltipElement.style.left = `${finalLeft}px`;
            tooltipElement.style.visibility = 'visible';
        } else if (tooltipRef.current) {
            tooltipRef.current.style.visibility = 'hidden';
        }
    }, [hoverInfo]);

   // --- ホバー用ツールチップ ---
   const renderTooltip = () => {
        if (!hoverInfo || !hoverInfo.feature) return null;
        const content = formatPopupContent(hoverInfo.feature.properties);

        const tooltipStyle: React.CSSProperties = {
            position: 'absolute',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '5px 8px',
            borderRadius: '3px',
            fontSize: '11px',
            fontFamily: 'sans-serif',
            zIndex: 1002,
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
            maxWidth: '300px',
            transformOrigin: 'top left',
            visibility: 'hidden', // 初期状態は非表示
        };

        return (
            <div ref={tooltipRef} style={tooltipStyle}
             dangerouslySetInnerHTML={{ __html: content }}
             />
        );
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

      {/* MapLibre ベース地図 */}
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
        interactiveLayerIds={['tomtom-traffic-layer']}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
          <ScaleControl unit="metric" position="bottom-left" />

          {/* クリック時のPopup (Mapの子要素として配置) */}
          {popupInfo && (
              <Popup
                  longitude={popupInfo.longitude}
                  latitude={popupInfo.latitude}
                  closeButton={true}
                  closeOnClick={false}
                  onClose={() => setPopupInfo(null)}
                  anchor="bottom" // 下から吹き出しが出るように
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
              >
                 <div dangerouslySetInnerHTML={{ __html: popupInfo.content }} />
              </Popup>
          )}
      </Map>

      {/* ホバー用ツールチップをレンダリング */}
      {renderTooltip()}

      <Legend />
      <BaseMapSwitcher currentStyle={currentMapStyleKey} onChangeStyle={setCurrentMapStyleKey} />
    </div>
  );
}

export default MapDashboard;

