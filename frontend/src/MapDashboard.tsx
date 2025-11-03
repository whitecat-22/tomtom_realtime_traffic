import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, MapRef, ViewState, ScaleControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// --- react-icons のインポート ---
import { LuMap, LuLayers, LuTriangleAlert } from 'react-icons/lu';
import { FaCar } from 'react-icons/fa6';

// --- 初期視点を環境変数から読み込む ---
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
    <div style={{ position: 'relative' }}> {/* ラッパーを追加 */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{
          backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px',
          padding: '5px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          //  MarineTraffic 風の正方形ボタン
          width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        title="Change map style"
      >
        <LuMap size={20} /> {/* react-icon */}
      </button>

      {isMenuOpen && (
        <div style={{
          position: 'absolute', top: '0', right: '40px', // ボタンの左側に表示
          backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '10px',
          borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          width: '120px', // パネル幅
          zIndex: 2,
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>Map type</h4>
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

// --- 【追加】レイヤー切り替えパネル ---
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
    bottom: '280px', // ボタン群と同じ高さ
    right: '50px', // ボタンの左側に表示
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: '10px',
    borderRadius: '5px',
    zIndex: 1,
    width: '150px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }}>
    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>Layers</h4>
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
  // content の型を React.ReactNode に変更
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number } | null>(null);
  const [popupInfo, setPopupInfo] = useState<{ longitude: number; latitude: number; content: React.ReactNode } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);

  const [isFlowVisible, setIsFlowVisible] = useState(true);
  const [isIncidentsVisible, setIsIncidentsVisible] = useState(true);

  // レイヤーパネル用の state
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

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
            // レイヤーIDの配列を使用
            const incidentLayerIds = [
                // 'tomtom-traffic-incident-point-layer',
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

  // --- Popup/Tooltipの内容を整形する関数 (JSXを返すように変更) ---
  // 交通流 (Flow) 用
  const formatFlowContent = (properties: any): React.ReactNode => {
    // --- スタイルとアイコン定義 (Flow) ---
    const style: React.CSSProperties = { fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 8px', borderRadius: '3px' };
    // react-icon を使用
    const title = (
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <FaCar size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Traffic Flow
        </strong>
    );

    if (!properties) return <div style={style}>{title}<br/>(No data)</div>;

    // --- 動的ロジック ---
    const internalKeys = new Set(['$type', 'layer', 'source', 'sourceLayer', 'state', 'tile']);
    const lines: React.ReactNode[] = [];
    const keys = Object.keys(properties).sort(); // ソート

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
        // JSX配列を直接渡す
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{lines}</div>;

    return <div style={style}>{title}{content}</div>;
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

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`; // 要望のフォーマット
    } catch (e) {
        return isoString; // エラー時も元の文字列を返す
    }
  };

  // インシデント (Incident) 用
  const formatIncidentContent = (properties: any): React.ReactNode => {
    // --- スタイルとアイコン定義 (Incident) ---
    const style: React.CSSProperties = { fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px', backgroundColor: 'rgba(255,249,196,0.7)', color: 'black', padding: '5px 8px', borderRadius: '3px', border: '1px solid #E0E0E0' };
    // react-icon を使用
    const title = (
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <LuTriangleAlert size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Traffic Incident
        </strong>
    );

    if (!properties) return <div style={style}>{title}<br/>(No data)</div>;

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

    const lines: React.ReactNode[] = [];
    const keys = Object.keys(properties).sort(); // ソート

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && !internalKeys.has(key)) {
            const value = properties[key];
            if (value !== undefined && value !== null) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

                let displayValue = String(value);

                if (key === 'delay') {
                    displayValue = `${String(value)} s`;

                } else if (key === 'magnitude') {
                    let magnitudeText = 'Unknown'; // 0 またはリスト外の場合
                    switch (Number(value)) {
                        case 1: magnitudeText = 'Minor'; break;
                        case 2: magnitudeText = 'Moderate'; break;
                        case 3: magnitudeText = 'Major'; break;
                        case 4: magnitudeText = 'Indefinite (road closures and other delays with an unstated length of time)'; break; // (短縮)
                    }
                    displayValue = `${String(value)}. ${magnitudeText}`;

                } else if (key.startsWith('icon_category')) {
                    const numericValue = Number(value);
                    const description = iconCategoryMap[numericValue]; // マップから説明を取得

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
        // JSX配列を直接渡す
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{lines}</div>;

    return <div style={style}>{title}{content}</div>;
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

    let content: React.ReactNode = null; // string -> React.ReactNode
    if (incidentFeature) { // インシデントを優先
      content = formatIncidentContent(incidentFeature.properties);
    } else if (flowFeature) { // 次に交通流
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
  }, []); // 依存配列は空

  // --- クリック時の処理 ---
  const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const { features, lngLat } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    const incidentFeature = features && features.find(f =>
        // f.layer.id === 'tomtom-traffic-incident-point-layer' ||
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );

    let featureToShow = null;
    let content: React.ReactNode = null; // string -> React.ReactNode

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
            // 【修正】 dangerouslySetInnerHTML -> {tooltipContent}
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
                {/* dangerouslySetInnerHTML -> {popupInfo.content} */}
                {popupInfo.content}
              </Popup>
          )}
      </Map>

      {renderTooltip()}
      <Legend />

      {/* --- MarineTraffic風 UIボタングループ --- */}
      <div style={{
        position: 'absolute',
        bottom: '280px', // 凡例 (Legend) の上
        right: '10px',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column', // 縦に積む
        gap: '8px', // ボタン間の隙間
      }}>
        {/* --- レイヤー切り替えボタン --- */}
        <button
          onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
          style={{
            backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px',
            padding: '5px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Toggle layers"
        >
          <LuLayers size={20} />
        </button>

        {/* --- ベースマップ切り替えボタン --- */}
        <BaseMapSwitcher currentStyle={currentMapStyleKey} onChangeStyle={setCurrentMapStyleKey} />
      </div>

      {/* --- レイヤー切り替えパネル --- */}
      {isLayerMenuOpen && (
          <LayerMenuPanel
              isFlowVisible={isFlowVisible}
              onToggleFlow={() => setIsFlowVisible(!isFlowVisible)}
              isIncidentsVisible={isIncidentsVisible}
              onToggleIncidents={() => setIsIncidentsVisible(!isIncidentsVisible)}
          />
      )}
    </div>
  );
}

export default MapDashboard;
